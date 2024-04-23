<?php

namespace QUI\Contact;

use DateTime;
use PDO;
use QUI;
use QUI\Exception;
use QUI\Security\Encryption;
use QUI\Utils\Grid;

use function json_decode;

/**
 * Class RequestList
 *
 * Manages single submitted form requests that are saved in the database
 */
class RequestList
{
    /**
     * Save a form request to the database
     *
     * @param QUI\FormBuilder\Field[] $formFields - The form fields with submit data
     * @param QUI\Interfaces\Projects\Site $FormSite - The Site the form was submitted from
     * @return void
     *
     * @throws QUI\Exception
     */
    public static function saveFormRequest(array $formFields, QUI\Interfaces\Projects\Site $FormSite): void
    {
        $Now = new DateTime();
        $submitData = [];
        $Conf = QUI::getPackage('quiqqer/contact')->getConfig();
        $encrypt = boolval($Conf->get('settings', 'encryptContactRequests'));

        foreach ($formFields as $FormField) {
            $submitData[$FormField->getName()] = $FormField->getValueText();
        }

        $formId = self::getFormIdByIdentifier(self::getFormIdentifier($FormSite));

        if (!$formId) {
            throw new ContactException([
                'quiqqer/contact',
                'exception.RequestList.no_form_id'
            ]);
        }

        $submitData = json_encode($submitData);

        if ($encrypt) {
            $submitData = Encryption::encrypt($submitData);
        }

        QUI::getDataBase()->insert(
            self::getRequestsTable(),
            [
                'formId' => $formId,
                'submitDate' => $Now->format('Y-m-d H:i:s'),
                'submitData' => $submitData,
            ]
        );
    }

    /**
     * Get all forms that save requests
     *
     * @return array
     */
    public static function getForms(): array
    {
        $result = QUI::getDataBase()->fetch([
            'select' => [
                'id',
                'identifier',
                'title',
                'dataFields'
            ],
            'from' => self::getFormsTable()
        ]);

        $parsed = [];
        $parsedTitles = [];
        $forms = [];

        foreach ($result as $row) {
            $title = $row['title'];
            $titleHash = md5($title);
            $identifier = $row['identifier'];

            if (isset($parsed[$identifier])) {
                continue;
            }

            if (!isset($parsedTitles[$titleHash])) {
                $parsedTitles[$titleHash] = 0;
            }

            $parsedTitles[$titleHash]++;

            if ($parsedTitles[$titleHash] > 1) {
                $title .= ' [' . ($parsedTitles[$titleHash] - 1) . ']';
            }

            $row['title'] = $title;
            $forms[] = $row;
        }

        return $forms;
    }

    /**
     * Get request list
     *
     * @param array $searchParams
     * @param bool $countOnly
     * @return array|int
     * @throws Exception
     * @throws \Doctrine\DBAL\Exception
     */
    public static function getList(array $searchParams, bool $countOnly = false): array|int
    {
        $Grid = new Grid($searchParams);
        $gridParams = $Grid->parseDBParams($searchParams);
        $Conf = QUI::getPackage('quiqqer/contact')->getConfig();
        $encrypt = boolval($Conf->get('settings', 'encryptContactRequests'));

        $binds = [];
        $where = [];

        if ($countOnly) {
            $sql = "SELECT COUNT(*)";
        } else {
            $sql = "SELECT *";
        }

        $sql .= " FROM `" . self::getRequestsTable() . "`";

        if (!empty($searchParams['id'])) {
            $where[] = '`formId` = ' . (int)$searchParams['id'];
        }

        if (!empty($searchParams['search'])) {
            $searchColumns = [
                'submitData'
            ];

            $whereOr = [];

            foreach ($searchColumns as $searchColumn) {
                $whereOr[] = '`' . $searchColumn . '` LIKE :search';
            }

            if (!empty($whereOr)) {
                $where[] = '(' . implode(' OR ', $whereOr) . ')';

                $binds['search'] = [
                    'value' => '%' . $searchParams['search'] . '%',
                    'type' => PDO::PARAM_STR
                ];
            }
        }

        // build WHERE query string
        if (!empty($where)) {
            $sql .= " WHERE " . implode(" AND ", $where);
        }

        // ORDER BY
        $sql .= " ORDER BY id DESC";

        // LIMIT
        if (
            !empty($gridParams['limit'])
            && !$countOnly
        ) {
            $sql .= " LIMIT " . $gridParams['limit'];
        } else {
            if (!$countOnly) {
                $sql .= " LIMIT " . 20;
            }
        }

        $Stmt = QUI::getPDO()->prepare($sql);

        // bind search values
        foreach ($binds as $var => $bind) {
            $Stmt->bindValue(':' . $var, $bind['value'], $bind['type']);
        }

        try {
            $Stmt->execute();
            $result = $Stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (\Exception $Exception) {
            QUI\System\Log::addError(
                self::class . ' :: search() -> ' . $Exception->getMessage()
            );

            return [];
        }

        if ($countOnly) {
            return (int)current(current($result));
        }

        if ($encrypt) {
            foreach ($result as $k => $row) {
                if (!self::isJSON($row['submitData'])) {
                    $result[$k]['submitData'] = Encryption::decrypt($row['submitData']);
                }
            }
        }

        return $result;
    }

    /**
     * Check if a string is in JSON format
     *
     * @param string $str
     * @return bool
     */
    protected static function isJSON(string $str): bool
    {
        $str = json_decode($str, true);
        return json_last_error() === JSON_ERROR_NONE && is_array($str);
    }

    /**
     * Delete contact requests
     *
     * @param array $requestIds
     * @return void
     */
    public static function deleteRequests(array $requestIds): void
    {
        array_walk($requestIds, function (&$v) {
            $v = (int)$v;
        });

        foreach ($requestIds as $requestId) {
            try {
                $resultFormIdentifier = QUI::getDataBase()->fetch([
                    'select' => ['formId', 'submitData'],
                    'from' => self::getRequestsTable(),
                    'where' => [
                        'id' => $requestId
                    ]
                ]);

                $requestData = $resultFormIdentifier[0];

                $resultFormData = QUI::getDataBase()->fetch([
                    'from' => self::getFormsTable(),
                    'where' => [
                        'id' => $requestData['formId']
                    ]
                ]);

                $formData = $resultFormData[0];

                if (
                    empty($formData['projectName']) ||
                    empty($formData['projectLang']) ||
                    empty($formData['siteId'])
                ) {
                    continue;
                }

                $Project = QUI::getProject($formData['projectName'], $formData['projectLang']);
                $Site = $Project->get($formData['siteId']);

                QUI::getEvents()->fireEvent(
                    'quiqqerContactDeleteFormRequest',
                    [
                        $requestId,
                        json_decode($requestData['submitData'], true),
                        $Site
                    ]
                );
            } catch (\Exception $Exception) {
                QUI\System\Log::writeException($Exception);
            }
        }

        QUI::getDataBase()->delete(
            self::getRequestsTable(),
            [
                'id' => [
                    'type' => 'IN',
                    'value' => $requestIds
                ]
            ]
        );
    }

    /**
     * Get unique form identifier of a quiqqer/contact Site
     *
     * @param QUI\Interfaces\Projects\Site $Site
     * @return string
     */
    public static function getFormIdentifier(QUI\Interfaces\Projects\Site $Site): string
    {
        $Project = $Site->getProject();
        $formData = $Site->getAttribute('quiqqer.contact.settings.form');

        if (empty($formData)) {
            $formHash = '';
        } else {
            $formData = json_decode($formData, true);
            $hashData = [];

            foreach ($formData['elements'] as $element) {
                $hashData[] = $element['type'];
            }

            $formHash = json_encode($hashData);
        }

        $identifierParts = [
            $Site->getId(),
            $Project->getName(),
            $Project->getLang(),
            $formHash
        ];

        return hash('sha256', implode('', $identifierParts));
    }

    /**
     * Get contact form ID by identifier
     *
     * @param string $identifier
     * @return int|false - ID if found; false if not found
     */
    public static function getFormIdByIdentifier(string $identifier): bool|int
    {
        $result = QUI::getDataBase()->fetch([
            'select' => 'id',
            'from' => self::getFormsTable(),
            'where' => [
                'identifier' => $identifier
            ]
        ]);

        if (empty($result)) {
            return false;
        }

        return (int)$result[0]['id'];
    }

    /**
     * Get table where forms are saved
     *
     * @return string
     */
    public static function getFormsTable(): string
    {
        return QUI::getDBTableName('quiqqer_contact_forms');
    }

    /**
     * Get table where requests are saved
     *
     * @return string
     */
    public static function getRequestsTable(): string
    {
        return QUI::getDBTableName('quiqqer_contact_requests');
    }
}

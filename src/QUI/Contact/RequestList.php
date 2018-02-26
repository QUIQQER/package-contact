<?php

namespace QUI\Contact;

use QUI;
use QUI\Projects\Site;
use QUI\Utils\Security\Orthos;
use QUI\Utils\Grid;

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
     * @param Site $FormSite - The Site the form was submitted from
     * @return void
     *
     * @throws QUI\Exception
     */
    public static function saveFormRequest($formFields, $FormSite)
    {
        $Now        = new \DateTime();
        $submitData = array();

        foreach ($formFields as $FormField) {
            $submitData[$FormField->getName()] = $FormField->getValueText();
        }

        $formId = self::getFormIdByIdentifier(self::getFormIdentifier($FormSite));

        if (!$formId) {
            throw new ContactException(array(
                'quiqqer/contact',
                'exception.RequestList.no_form_id'
            ));
        }

        QUI::getDataBase()->insert(
            self::getRequestsTable(),
            array(
                'formId'     => $formId,
                'submitDate' => $Now->format('Y-m-d H:i:s'),
                'submitData' => json_encode($submitData),
            )
        );
    }

    /**
     * Get all forms that save requests
     *
     * @return array
     */
    public static function getForms()
    {
        $result = QUI::getDataBase()->fetch(array(
            'select' => array(
                'id',
                'identifier',
                'title',
                'dataFields'
            ),
            'from'   => self::getFormsTable()
        ));

        $parsed       = array();
        $parsedTitles = array();
        $forms        = array();

        foreach ($result as $row) {
            $title      = $row['title'];
            $titleHash  = md5($title);
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
            $forms[]      = $row;
        }

        return $forms;
    }

    /**
     * Get request list
     *
     * @param $searchParams
     * @param bool $countOnly
     * @return array|int
     */
    public static function getList($searchParams, $countOnly = false)
    {
        $Grid       = new Grid($searchParams);
        $gridParams = $Grid->parseDBParams($searchParams);

        $binds = array();
        $where = array();

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
            $searchColumns = array(
                'submitData'
            );

            $whereOr = array();

            foreach ($searchColumns as $searchColumn) {
                $whereOr[] = '`' . $searchColumn . '` LIKE :search';
            }

            if (!empty($whereOr)) {
                $where[] = '(' . implode(' OR ', $whereOr) . ')';

                $binds['search'] = array(
                    'value' => '%' . $searchParams['search'] . '%',
                    'type'  => \PDO::PARAM_STR
                );
            }
        }

        // build WHERE query string
        if (!empty($where)) {
            $sql .= " WHERE " . implode(" AND ", $where);
        }

        // ORDER BY
        $sql .= " ORDER BY id DESC";

        // LIMIT
        if (!empty($gridParams['limit'])
            && !$countOnly
        ) {
            $sql .= " LIMIT " . $gridParams['limit'];
        } else {
            if (!$countOnly) {
                $sql .= " LIMIT " . (int)20;
            }
        }

        $Stmt = QUI::getPDO()->prepare($sql);

        // bind search values
        foreach ($binds as $var => $bind) {
            $Stmt->bindValue(':' . $var, $bind['value'], $bind['type']);
        }

        try {
            $Stmt->execute();
            $result = $Stmt->fetchAll(\PDO::FETCH_ASSOC);
        } catch (\Exception $Exception) {
            QUI\System\Log::addError(
                self::class . ' :: search() -> ' . $Exception->getMessage()
            );

            return array();
        }

        if ($countOnly) {
            return (int)current(current($result));
        }

        return $result;
    }

    /**
     * Delete contact requests
     *
     * @param array $requestIds
     * @return void
     */
    public static function deleteRequests($requestIds)
    {
        array_walk($requestIds, function (&$v) {
            $v = (int)$v;
        });

        QUI::getDataBase()->delete(
            self::getRequestsTable(),
            array(
                'id' => array(
                    'type'  => 'IN',
                    'value' => $requestIds
                )
            )
        );
    }

    /**
     * Get unique form identifier of a quiqqer/contact Site
     *
     * @param Site $Site
     * @return string
     *
     * @throws QUI\Exception
     */
    public static function getFormIdentifier(Site $Site)
    {
        $Project  = $Site->getProject();
        $formData = $Site->getAttribute('quiqqer.contact.settings.form');

        if (empty($formData)) {
            $formHash = '';
        } else {
            $formData = json_decode($formData, true);
            $hashData = array();

            foreach ($formData['elements'] as $element) {
                $hashData[] = $element['type'];
            }

            $formHash = json_encode($hashData);
        }

        $identifierParts = array(
            $Site->getId(),
            $Project->getName(),
            $Project->getLang(),
            $formHash
        );

        return hash('sha256', implode('', $identifierParts));
    }

    /**
     * Get contact form ID by identifier
     *
     * @param string $identifier
     * @return int|false - ID if found; false if not found
     */
    public static function getFormIdByIdentifier($identifier)
    {
        $result = QUI::getDataBase()->fetch(array(
            'select' => 'id',
            'from'   => self::getFormsTable(),
            'where'  => array(
                'identifier' => $identifier
            )
        ));

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
    public static function getFormsTable()
    {
        return QUI::getDBTableName('quiqqer_contact_forms');
    }

    /**
     * Get table where requests are saved
     *
     * @return string
     */
    public static function getRequestsTable()
    {
        return QUI::getDBTableName('quiqqer_contact_requests');
    }
}

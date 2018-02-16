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
     * @param Site $FormSite (optional) - The Site the form was submitted from
     * @return void
     */
    public static function saveFormRequest($formFields, $FormSite = null)
    {
        $title = 'other';

        if (!is_null($FormSite)) {
            $title = $FormSite->getAttribute('title') . ' (' . $FormSite->getProject()->getLang() . ')';
        }

        $Now = new \DateTime();

        $dataFields = array();
        $submitData = array();

        foreach ($formFields as $FormField) {
            $fieldName = $FormField->getName();

            $dataFields[] = array(
                'name'     => $fieldName,
                'label'    => $FormField->getAttribute('label') ?: $fieldName,
                'required' => $FormField->getAttribute('required') ? true : false
            );

            $submitData[$fieldName] = $FormField->getValueText();
        }

        $dataFields = json_encode($dataFields);

        QUI::getDataBase()->insert(
            self::getTable(),
            array(
                'title'      => $title,
                'submitDate' => $Now->format('Y-m-d H:i:s'),
                'submitData' => json_encode($submitData),
                'dataFields' => $dataFields,
                'identifier' => hash('sha256', $title . $dataFields)
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
                'identifier',
                'title',
                'dataFields'
            ),
            'from'   => self::getTable()
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

            $row['id']    = $identifier;
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

        $sql .= " FROM `" . self::getTable() . "`";

        if (!empty($searchParams['id'])) {
            $where[] = '`identifier` = ' . (int)$searchParams['id'];
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

        // ORDER
        if (!empty($searchParams['sortOn'])
        ) {
            $sortOn = Orthos::clear($searchParams['sortOn']);
            $order  = "ORDER BY " . $sortOn;

            if (isset($searchParams['sortBy']) &&
                !empty($searchParams['sortBy'])
            ) {
                $order .= " " . Orthos::clear($searchParams['sortBy']);
            } else {
                $order .= " ASC";
            }

            $sql .= " " . $order;
        } else {
            $sql .= " ORDER BY id DESC";
        }

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
     * Get table where requests are saved
     *
     * @return string
     */
    public static function getTable()
    {
        return QUI::getDBTableName('quiqqer_contact_requests');
    }
}

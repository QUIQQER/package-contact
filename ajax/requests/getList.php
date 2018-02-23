<?php

use QUI\Contact\RequestList;
use QUI\Utils\Security\Orthos;
use QUI\Utils\Grid;

/**
 * Get list of contact requests
 *
 * @param array $searchParams
 * @return int|false - New InviteCode ID or false on error
 */
QUI::$Ajax->registerFunction(
    'package_quiqqer_contact_ajax_requests_getList',
    function ($searchParams) {
        $searchParams = Orthos::clearArray(json_decode($searchParams, true));

        try {
            $Grid     = new Grid($searchParams);
            $result   = RequestList::getList($searchParams);
            $gridRows = array();

            foreach ($result as $k => $row) {
                $rowData = json_decode($row['submitData'], true);

                $rowData['submitDate'] = $row['submitDate'];
                $rowData['id']         = $row['id'];
                $rowData['formId']     = $row['formId'];

                $gridRows[] = $rowData;
            }

            return $Grid->parseResult(
                $gridRows,
                RequestList::getList($searchParams, true)
            );
        } catch (\Exception $Exception) {
            QUI\System\Log::writeException($Exception);

            QUI::getMessagesHandler()->addError(
                QUI::getLocale()->get(
                    'quiqqer/contact',
                    'message.ajax.general_error'
                )
            );

            return false;
        }
    },
    array('searchParams'),
    'Permission::checkAdminUser'
);

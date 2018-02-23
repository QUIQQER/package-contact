<?php

use QUI\Contact\RequestList;

/**
 * Delete contact requests
 *
 * @param array $requestIds
 * @return bool - success
 */
QUI::$Ajax->registerFunction(
    'package_quiqqer_contact_ajax_requests_deleteRequests',
    function ($requestIds) {
        try {
            RequestList::deleteRequests(json_decode($requestIds, true));
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

        QUI::getMessagesHandler()->addSuccess(
            QUI::getLocale()->get(
                'quiqqer/contact',
                'message.ajax.requests.deleteRequests.success'
            )
        );

        return true;
    },
    array('requestIds'),
    'Permission::checkAdminUser'
);

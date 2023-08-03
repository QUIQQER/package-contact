<?php

/**
 * Get list of contact requests
 *
 * @param array $searchParams
 * @return int|false - New InviteCode ID or false on error
 */

use QUI\Contact\RequestList;

QUI::$Ajax->registerFunction(
    'package_quiqqer_contact_ajax_requests_getForms',
    function () {
        try {
            return RequestList::getForms();
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
    array(),
    'Permission::checkAdminUser'
);

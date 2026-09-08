<?php

/**
 * Whether the AI agent view is available for the CTA action brick.
 *
 * Used by the brick editor to decide whether the "Auswahl" and "KI Agent"
 * options of the "Ansicht beim Öffnen" setting may be offered.
 *
 * Reports whether any installed package offers a brick declaring the ai agent
 * category - not whether a specific package is installed. Whether the project
 * actually contains such a brick is a separate question, answered by the
 * brick picker of the setting itself.
 */

use QUI\Contact\CtaAction\Control;

QUI::getAjax()->registerFunction(
    'package_quiqqer_contact_ajax_ctaAction_isAiAgentViewAvailable',
    function () {
        return Control::isAiAgentViewAvailable();
    },
    false,
    'Permission::checkAdminUser'
);

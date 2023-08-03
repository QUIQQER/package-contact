<?php

/**
 * Get form fields for a specific formbuilder site
 *
 * @param array $project
 * @param int $siteId
 * @return bool - success
 */

use QUI\FormBuilder\Builder;

QUI::$Ajax->registerFunction(
    'package_quiqqer_contact_ajax_getFields',
    function ($project, $siteId) {
        $Project = QUI::getProjectManager()->decode($project);
        $Site = $Project->get((int)$siteId);

        $FormBuilder = new Builder();
        $formData = $Site->getAttribute('quiqqer.contact.settings.form');

        if (!empty($formData)) {
            $FormBuilder->load(\json_decode($formData, true));
        }

        $formElements = $FormBuilder->getElements();
        $fields = [];

        foreach ($formElements as $k => $Field) {
            $fields[] = [
                'id' => $k,
                'label' => $Field->getAttribute('label'),
                'required' => \boolval($Field->getAttribute('required'))
            ];
        }

        return $fields;
    },
    ['project', 'siteId'],
    'Permission::checkAdminUser'
);

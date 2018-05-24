<?php

namespace QUI\Contact;

use QUI;

/**
 * Class Handler
 *
 * General Handler for quiqqer/contact
 */
class Handler
{
    /**
     * Add custom form fields to a Form based on module settings
     *
     * @param QUI\FormBuilder\Builder $Form - The form that the custom fields are added to
     * @return void
     */
    public static function addCustomFormFields(QUI\FormBuilder\Builder $Form)
    {
        try {
            $Conf = QUI::getPackage('quiqqer/contact')->getConfig();
        } catch (\Exception $Exception) {
            QUI\System\Log::writeException($Exception);
            return;
        }

        $customFields = [];

        if ($Conf->get('settings', 'globalPrivacyPolicyField')
            && !$Form->getAttribute('hideGlobalPrivacyPolicy')) {
            $customFields[] = [
                'type'       => 'package/quiqqer/formbuilder/bin/fields/PrivacyPolicyCheckbox',
                'attributes' => [
                    'label'    => QUI::getLocale()->get(
                        'quiqqer/contact',
                        'global.PrivacyPolicy.field_label'
                    ),
                    'text'     => QUI::getLocale()->get(
                        'quiqqer/contact',
                        'global.PrivacyPolicy.checkbox_label'
                    ),
                    'required' => true
                ]
            ];
        }

        $Form->addCustomFields($customFields);
    }
}

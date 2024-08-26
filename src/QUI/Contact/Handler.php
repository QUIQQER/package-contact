<?php

namespace QUI\Contact;

use Exception;
use QUI;
use QUI\FormBuilder\Builder as Form;

use function is_array;
use function json_decode;
use function str_replace;

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
    public static function addCustomFormFields(QUI\FormBuilder\Builder $Form): void
    {
        try {
            $Conf = QUI::getPackage('quiqqer/contact')->getConfig();
        } catch (Exception $Exception) {
            QUI\System\Log::writeException($Exception);
            return;
        }

        $customFields = [];

        if (
            $Conf->get('settings', 'globalPrivacyPolicyField')
            && !$Form->getAttribute('hideGlobalPrivacyPolicy')
        ) {
            $customFields[] = [
                'type' => 'package/quiqqer/formbuilder/bin/fields/PrivacyPolicyCheckbox',
                'attributes' => [
                    'label' => QUI::getLocale()->get(
                        'quiqqer/contact',
                        'global.PrivacyPolicy.field_label'
                    ),
                    'text' => QUI::getLocale()->get(
                        'quiqqer/contact',
                        'global.PrivacyPolicy.checkbox_label'
                    ),
                    'required' => true
                ]
            ];
        }

        $Form->addCustomFields($customFields);
    }

    /**
     * Sends administrator mails for a submitted form
     *
     * @param Form $Form
     * @return void
     *
     * @throws QUI\Exception|\PHPMailer\PHPMailer\Exception
     */
    public static function sendFormAdminMails(Form $Form): void
    {
        $Mail = QUI::getMailManager()->getMailer();
        $addresses = $Form->getAddresses();

        if (empty($addresses)) {
            return;
        }

        foreach ($addresses as $addressData) {
            $Mail->addRecipient($addressData['email'], $addressData['name']);
        }

        foreach ($Form->getElements() as $FormElement) {
            if ($FormElement->getType() == 'QUI\FormBuilder\Fields\EMail') {
                $recipient = $FormElement->getAttribute('data');

                if (is_array($recipient)) {
                    foreach ($recipient as $r) {
                        if (QUI\Utils\Security\Orthos::checkMailSyntax($r)) {
                            $Mail->addReplyTo($r);
                        }
                    }
                } else {
                    if (QUI\Utils\Security\Orthos::checkMailSyntax($recipient)) {
                        $Mail->addReplyTo($recipient);
                    }
                }
            }
        }

        $Mail->setSubject($Form->getMailSubject());
        $Mail->setBody($Form->getMailBody());
        $Mail->send();
    }

    /**
     * Sends mail to submitter for a submitted form
     *
     * @param Form $Form
     * @param QUI\Projects\Site $Site
     * @return void
     *
     * @throws QUI\Exception|\PHPMailer\PHPMailer\Exception
     */
    public static function sendFormSuccessMail(Form $Form, QUI\Projects\Site $Site): void
    {
        $mailData = $Site->getAttribute('quiqqer.contact.success_mail');

        if (empty($mailData)) {
            return;
        }

        $mailData = json_decode($mailData, true);

        if (empty($mailData['send']) || empty($mailData['body']) || empty($mailData['subject'])) {
            return;
        }

        $Mail = QUI::getMailManager()->getMailer();

        // Determine recipient
        $recipient = false;
        $formElements = $Form->getElements();

        foreach ($formElements as $FormElement) {
            if ($FormElement->getType() == 'QUI\FormBuilder\Fields\EMail') {
                $data = $FormElement->getAttribute('data');

                if (QUI\Utils\Security\Orthos::checkMailSyntax($data)) {
                    $recipient = $data;
                    break;
                }
            }
        }

        if (!$recipient) {
            return;
        }

        $Mail->addRecipient($recipient);

        $mailBody = $mailData['body'];

        // Replace placeholders with actual values
        foreach ($formElements as $k => $Field) {
            $mailBody = str_replace(
                [
                    '{{label' . $k . '}}',
                    '{{value' . $k . '}}'
                ],
                [
                    $Field->getAttribute('label'),
                    $Field->getValueText()
                ],
                $mailBody
            );
        }

        $Mail->setSubject($mailData['subject']);
        $Mail->setBody($mailBody);
        $Mail->send();
    }
}

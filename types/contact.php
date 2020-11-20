<?php

use QUI\Contact\RequestList;
use QUI\Contact\Handler;
use QUI\Contact\Blacklist;
use QUI\FormBuilder\Fields\EMail as FormBuilderEmailType;
use QUI\Contact\ContactException;

$formData = json_decode($Site->getAttribute('quiqqer.contact.settings.form'), true);

if (!is_array($formData)) {
    $formData = [];
}

$Form = new QUI\FormBuilder\Builder();
$Form->load($formData);

Handler::addCustomFormFields($Form);

$Form->setAttribute('Template', $Template);
$Form->setSite($Site);

try {
    $Form->handleRequest();

    $ip = $_SERVER['REMOTE_ADDR'];

    if ($Form->isSuccess()) {
        /** @var QUI\FormBuilder\Field $FormElement */
        foreach ($Form->getElements() as $FormElement) {
            if ($FormElement->getType() === FormBuilderEmailType::class) {
                if (Blacklist::isEmailAddressBlacklisted($FormElement->getValueText())) {
                    throw new ContactException([
                        'quiqqer/contact',
                        'exception.types.contact.blacklisted'
                    ]);
                };
            }
        }

        if (Blacklist::isIpBlacklistedByIpList($ip)) {
            throw new ContactException([
                'quiqqer/contact',
                'exception.types.contact.blacklisted'
            ]);
        }

        $blacklistHost = Blacklist::isIpBlacklistedByDNSBL($ip, true);

        if ($blacklistHost) {
            throw new ContactException([
                'quiqqer/contact',
                'exception.types.contact.blacklisted_host',
                [
                    'blacklistHost' => $blacklistHost
                ]
            ]);
        }

        // save form request in database
        $saveForm = boolval($Form->getAttribute('save'));

        if ($saveForm) {
            RequestList::saveFormRequest($Form->getElements(), $Site);
        }

        // send form request via mail
        $addresses = $Form->getAddresses();

        if (!$saveForm && empty($addresses)) {
            throw new \QUI\Contact\ContactException([
                'quiqqer/contact',
                'exception.types.contact.no_recipients'
            ]);
        }

        // Admin mail(s)
        try {
            Handler::sendFormAdminMails($Form);
        } catch (\Exception $Exception) {
            QUI\System\Log::writeException($Exception);
        }

        // Submitter mail
        try {
            Handler::sendFormSuccessMail($Form, $Site);
        } catch (\Exception $Exception) {
            QUI\System\Log::writeException($Exception);
        }

        $Engine->assign([
            'formMessage' => $Site->getAttribute('quiqqer.contact.success'),
            'form'        => ''
        ]);
    } else {
        $Engine->assign([
            'form' => $Form->create()
        ]);
    }
} catch (QUI\Exception $Exception) {
    $Engine->assign([
        'formError' => $Exception->getMessage(),
        'form'      => $Form->create()
    ]);
}

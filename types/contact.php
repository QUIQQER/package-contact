<?php

use QUI\Contact\RequestList;
use QUI\Contact\Handler;

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

    if ($Form->isSuccess()) {
        // save form request in database
        $saveForm = boolval($Form->getAttribute('save'));

        if ($saveForm) {
            RequestList::saveFormRequest($Form->getElements(), $Site);
        }

        // send form request via mail
        $Mail      = QUI::getMailManager()->getMailer();
        $addresses = $Form->getAddresses();

        if (!$saveForm && empty($addresses)) {
            throw new \QUI\Contact\ContactException([
                'quiqqer/contact',
                'exception.types.contact.no_recipients'
            ]);
        }

        if (!empty($addresses)) {
            foreach ($addresses as $addressData) {
                $Mail->addRecipient($addressData['email'], $addressData['name']);
            }

            /* @var $FormElement \QUI\FormBuilder\Field */
            foreach ($Form->getElements() as $FormElement) {
                if ($FormElement->getType() == 'QUI\FormBuilder\Fields\EMail') {
                    $data = $FormElement->getAttribute('data');
                    if (QUI\Utils\Security\Orthos::checkMailSyntax($data)) {
                        $Mail->addReplyTo($FormElement->getAttribute('data'));
                    }
                }
            }

            $Mail->setSubject($Site->getAttribute('title'));
            $Mail->setBody($Form->getMailBody());
            $Mail->send();
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

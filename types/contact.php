<?php

$formData = json_decode($Site->getAttribute('quiqqer.contact.settings.form'), true);

if (!is_array($formData)) {
    $formData = array();
}

$Form = new QUI\FormBuilder\Builder();
$Form->load($formData);
$Form->setAttribute('Template', $Template);

try {
    $Form->handleRequest();

    if ($Form->isSuccess()) {
        $Mail      = QUI::getMailManager()->getMailer();
        $addresses = $Form->getAddresses();

        foreach ($addresses as $addressData) {
            $Mail->addRecipient($addressData['email'], $addressData['name']);
        }

        /* @var $FormElement \QUI\FormBuilder\Field */
        foreach ($Form->getElements() as $FormElement) {
            if ($FormElement->getType() == 'QUI\FormBuilder\Fields\EMail') {
                $data = $FormElement->getAttribute('data');
                if (\QUI\Utils\Security\Orthos::checkMailSyntax($data)) {
                    $Mail->addReplyTo($FormElement->getAttribute('data'));
                }
            }
        }

        $Mail->setSubject($Site->getAttribute('title'));
        $Mail->setBody($Form->getMailBody());
        $Mail->send();

        $Engine->assign(array(
            'formMessage' => $Site->getAttribute('quiqqer.contact.success'),
            'form' => ''
        ));

    } else {
        $Engine->assign(array(
            'form' => $Form->create()
        ));
    }

} catch (QUI\Exception $Exception) {
    $Engine->assign(array(
        'formError' => $Exception->getMessage(),
        'form' => $Form->create()
    ));
}

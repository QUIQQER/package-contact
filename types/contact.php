<?php

$formData = json_decode($Site->getAttribute('quiqqer.contact.settings.form'), true);

if (!is_array($formData)) {
    $formData = array();
}

$Form = new QUI\FormBuilder\Builder();
$Form->load($formData);

$Engine->assign(array(
    'Form' => $Form
));
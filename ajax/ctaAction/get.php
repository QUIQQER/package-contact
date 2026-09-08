<?php

/**
 * Renders the CTA action control.
 *
 * Optional brickParams (a JSON map) are the values whoever opened the control
 * handed in, e.g. the package a visitor clicked. They are applied under the
 * "param-" prefix, exactly as the brick render does, so a client can never
 * reach a real setting through them - the attribute allowlist stays untouched.
 * The control passes them on to the ai agent brick it renders.
 */

use QUI\Bricks\Utils;
use QUI\Contact\CtaAction\Control;

QUI::getAjax()->registerFunction(
    'package_quiqqer_contact_ajax_ctaAction_get',
    function ($attributes, $brickParams) {
        $control = new Control();

        if (!empty($attributes) && is_string($attributes)) {
            $allowed = Control::getAllowedAttributes();
            $attributes = json_decode($attributes, true);

            if (!empty($attributes) && is_array($attributes)) {
                $attributes = array_intersect_key($attributes, array_flip($allowed));
            } else {
                $attributes = [];
            }
            $control->setAttributes($attributes);
        }

        foreach (Utils::brickParamsFromRequest($brickParams) as $name => $value) {
            $control->setAttribute($name, $value);
        }

        $html = QUI\Control\Manager::getCSS();
        $html .= $control->create();

        return $html;
    },
    ['attributes', 'brickParams']
);

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

        // A selected brick owns its configuration. Window option defaults must
        // not replace its saved offers or view/sidebar settings.
        $brickId = (int)$control->getAttribute('data-brickid');

        if ($brickId > 0) {
            $Brick = QUI\Bricks\Manager::init()?->getBrickById($brickId);

            if (!$Brick || !$Brick->isInstanceOf(Control::class)) {
                throw new QUI\Exception('Invalid contact brick');
            }

            $params = Utils::brickParamsFromRequest($brickParams);

            if ($params !== []) {
                $Brick->setAttribute('cacheable', 0);

                foreach ($params as $name => $value) {
                    $Brick->setSetting($name, $value);
                }
            }

            $body = $Brick->create();
            return QUI\Control\Manager::getCSS() . $body;
        }

        foreach (Utils::brickParamsFromRequest($brickParams) as $name => $value) {
            $control->setAttribute($name, $value);
        }

        $body = $control->create();
        return QUI\Control\Manager::getCSS() . $body;
    },
    ['attributes', 'brickParams']
);

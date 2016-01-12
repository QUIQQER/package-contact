<?php

/**
 * This file contains QUI\Contact\EventHandler
 */
namespace QUI\Contact;

/**
 * Class EventHandler
 *
 * @package QUI\Contact
 */
class EventHandler
{
    /**
     * @param \QUI\Projects\Site $Site
     */
    public static function onSiteInit($Site)
    {
        if ($Site->getAttribute('type') == 'quiqqer/contact:types/contact'
            && !empty($_POST)
        ) {
            $Site->setAttribute('nocache', 1);
        }
    }
}

<?php

/**
 * This file contains QUI\Contact\EventHandler
 */

namespace QUI\Contact;

use QUI;
use QUI\Projects\Site;

use function json_encode;

/**
 * Class EventHandler
 *
 * @package QUI\Contact
 */
class EventHandler
{
    /**
     * @param QUI\Interfaces\Projects\Site $Site
     */
    public static function onSiteInit(QUI\Interfaces\Projects\Site $Site): void
    {
        if (
            $Site->getAttribute('type') == 'quiqqer/contact:types/contact'
            && !empty($_POST)
        ) {
            $Site->setAttribute('nocache', 1);
        }
    }

    /**
     * quiqqer/core: onPackageSetup
     *
     * @param QUI\Package\Package $Package
     * @return void
     *
     * @throws QUI\Exception
     */
    public static function onPackageSetup(QUI\Package\Package $Package): void
    {
        if ($Package->getName() !== 'quiqqer/contact') {
            return;
        }

        $Projects = QUI::getProjectManager();
        $projects = $Projects->getProjects();

        foreach ($projects as $project) {
            $Project = $Projects->getProject($project);

            foreach ($Project->getLanguages() as $lang) {
                $Project = $Projects->getProject($project, $lang);

                try {
                    $contactSites = $Project->getSites([
                        'where' => [
                            'active' => -1,
                            'type' => 'quiqqer/contact:types/contact'
                        ]
                    ]);
                } catch (QUI\Exception) {
                    continue;
                }

                foreach ($contactSites as $Site) {
                    self::parseContactSiteIntoFormTable($Site);
                }
            }
        }
    }

    /**
     * quiqqer/core: onSiteSave
     *
     * @param Site $Site
     * @return void
     *
     * @throws QUI\Exception
     */
    public static function onSiteSave(Site $Site): void
    {
        if ($Site->getAttribute('type') !== 'quiqqer/contact:types/contact') {
            return;
        }

        self::parseContactSiteIntoFormTable($Site);

        $SiteEdit = $Site->getEdit();

        // Default success message
        $successMessage = $Site->getAttribute('quiqqer.contact.success');

        if (empty($successMessage)) {
            $SiteEdit->setAttribute(
                'quiqqer.contact.success',
                QUI::getLocale()->get('quiqqer/contact', 'contact.default.success_msg')
            );
        }

        // Default success mail subject and body
        $successMail = $Site->getAttribute('quiqqer.contact.success_mail');

        if (empty($successMail)) {
            $successMail = [
                'send' => false,
                'subject' => QUI::getLocale()->get('quiqqer/contact', 'contact.default.success_mail_subject'),
                'body' => QUI::getLocale()->get('quiqqer/contact', 'contact.default.success_mail_body')
            ];

            $Site->setAttribute('quiqqer.contact.success_mail', json_encode($successMail));
        }

        $SiteEdit->save(QUI::getUsers()->getSystemUser());
    }

    /**
     * Parses information from a quiqqer/contact:types/contact Site to the quiqqer_contact_forms table
     *
     * @param Site $Site
     * @throws QUI\Exception
     */
    protected static function parseContactSiteIntoFormTable(Site $Site): void
    {
        $formFields = $Site->getAttribute('quiqqer.contact.settings.form');

        if (!$formFields) {
            return;
        }

        $formFields = json_decode($formFields, true);

        if (empty($formFields['elements'])) {
            return;
        }

        $formFields = $formFields['elements'];
        $formIdentifier = RequestList::getFormIdentifier($Site);
        $Project = $Site->getProject();
        $title = $Project->getName() . ' (' . $Project->getLang() . '): ' . $Site->getAttribute('title');

        $result = QUI::getDataBase()->fetch([
            'count' => 1,
            'from' => RequestList::getFormsTable(),
            'where' => [
                'identifier' => $formIdentifier
            ]
        ]);

        $exists = (int)current(current($result)) > 0;
        $dataFields = [];
        $FormBuilder = new QUI\FormBuilder\Builder();

        foreach ($formFields as $k => $field) {
            $Field = $FormBuilder->getField($field);

            if (!$Field) {
                continue;
            }

            $Field->setNameId($k);

            $fieldName = $Field->getName();

            $dataFields[] = [
                'name' => $fieldName,
                'label' => $Field->getAttribute('label') ?: $fieldName,
                'required' => (bool)$Field->getAttribute('required')
            ];
        }

        $dataFields = json_encode($dataFields);

        // if exists only update title
        if ($exists) {
            QUI::getDataBase()->update(
                RequestList::getFormsTable(),
                [
                    'title' => $title,
                    'dataFields' => $dataFields,
                    'projectName' => $Project->getName(),
                    'projectLang' => $Project->getLang(),
                    'siteId' => $Site->getId()
                ],
                [
                    'identifier' => $formIdentifier
                ]
            );

            return;
        }

        // if not exists -> insert
        QUI::getDataBase()->insert(
            RequestList::getFormsTable(),
            [
                'title' => $title,
                'dataFields' => $dataFields,
                'identifier' => $formIdentifier,
                'projectName' => $Project->getName(),
                'projectLang' => $Project->getLang(),
                'siteId' => $Site->getId()
            ]
        );
    }
}

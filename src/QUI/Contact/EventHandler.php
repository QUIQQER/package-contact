<?php

/**
 * This file contains QUI\Contact\EventHandler
 */

namespace QUI\Contact;

use Doctrine\DBAL\Exception as DBALException;
use QUI;
use QUI\Projects\Site;
use QUI\Utils\Doctrine;

use function json_encode;

/**
 * Class EventHandler
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

        foreach ($Projects->getProjects(true) as $Project) {
            $projectName = $Project->getName();

            foreach ($Project->getLanguages() as $lang) {
                $LangProject = $Projects->getProject($projectName, $lang);

                try {
                    $contactSites = $LangProject->getSites([
                        'where' => [
                            'active' => -1,
                            'type' => 'quiqqer/contact:types/contact'
                        ]
                    ]);
                } catch (QUI\Exception) {
                    continue;
                }

                if (is_array($contactSites) === false) {
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

            $SiteEdit->setAttribute('quiqqer.contact.success_mail', json_encode($successMail));
        }

        $SiteEdit->save(QUI::getUsers()->getSystemUser());
    }

    /**
     * Parses information from a quiqqer/contact:types/contact Site to the quiqqer_contact_forms table
     *
     * @param QUI\Interfaces\Projects\Site $Site
     * @throws QUI\Exception|DBALException
     */
    protected static function parseContactSiteIntoFormTable(QUI\Interfaces\Projects\Site $Site): void
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

        $Connection = QUI::getDataBaseConnection();
        $table = Doctrine::quoteIdentifier(RequestList::getFormsTable());
        $exists = (int)$Connection->createQueryBuilder()
            ->select('COUNT(*)')
            ->from($table)
            ->where(Doctrine::quoteIdentifier('identifier') . ' = :identifier')
            ->setParameter('identifier', $formIdentifier)
            ->executeQuery()
            ->fetchOne() > 0;
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

        // if there exists only update title
        if ($exists) {
            $Connection->update(
                $table,
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
        $Connection->insert(
            $table,
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

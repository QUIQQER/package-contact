<?php

namespace QUI\Contact;

use QUI;
use QUI\FormBuilder\Builder;
use QUI\FormBuilder\Fields\EMail as FormBuilderEmailType;
use QUI\Utils\Security\Orthos;

/**
 * Class Blacklist
 *
 * Provides methods to filter contact requests by a number of blacklisting measures
 */
class Blacklist
{
    /**
     * Blacklist configuration
     *
     * @var array|null
     */
    protected static ?array $conf = null;

    /**
     * Check if a submitted form is blacklisted by any measure
     *
     * @param Builder $Form
     * @return bool
     */
    public static function isBlacklisted(Builder $Form): bool
    {
        $ip = $_SERVER['REMOTE_ADDR'];

        foreach ($Form->getElements() as $FormElement) {
            if ($FormElement->getType() === FormBuilderEmailType::class) {
                if (self::isEmailAddressBlacklisted($FormElement->getValueText())) {
                    return true;
                }
            }
        }

        if (self::isIpBlacklistedByIpList($ip) || self::isIpBlacklistedByDNSBL($ip)) {
            return true;
        }

        return false;
    }

    /**
     * Check if an IP is blacklisted by an IP address (range) filter list
     *
     * @param string $ip
     * @return bool
     */
    public static function isIpBlacklistedByIpList(string $ip): bool
    {
        $conf = self::getBlacklistConf();
        $ipList = json_decode($conf['ipAddresses'], true);
        $longIp = ip2long($ip);

        if (empty($ipList) || !is_array($ipList)) {
            $ipList = [];
        }

        foreach ($ipList as $entry) {
            if (empty($entry)) {
                continue;
            }

            // single IP
            if (mb_strpos($entry, "-") === false) {
                $longIpCheck = ip2long($entry);

                if (empty($longIpCheck)) {
                    QUI\System\Log::addError(
                        'Package quiqqer/contact -> An IP address that is used for blacklisting'
                        . ' has the wrong format: "' . $entry . '"'
                    );

                    continue;
                }

                if ($longIp === $longIpCheck) {
                    return true;
                }

                continue;
            }

            // IP range
            $rangeIps = explode("-", $entry);

            if (empty($rangeIps[0]) || empty($rangeIps[1])) {
                QUI\System\Log::addError(
                    'Package quiqqer/contact -> An IP address range that is used for blacklisting'
                    . ' has the wrong format: "' . $entry . '"'
                );

                continue;
            }

            $longIpCheck1 = ip2long($rangeIps[0]);
            $longIpCheck2 = ip2long($rangeIps[1]);

            if (empty($longIpCheck1) || empty($longIpCheck2)) {
                QUI\System\Log::addError(
                    'Package quiqqer/contact -> An IP address range that is used for blacklisting'
                    . ' has the wrong format: "' . $entry . '"'
                );

                continue;
            }

            if (
                $longIp >= $longIpCheck1
                && $longIp <= $longIpCheck2
            ) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if an email address is on the blacklist
     *
     * @param string $email
     * @return bool
     */
    public static function isEmailAddressBlacklisted(string $email): bool
    {
        if (!Orthos::checkMailSyntax($email)) {
            QUI\System\Log::addDebug(
                'Package quiqqer/contact -> The e-mail address that the user provided and that'
                . ' is checked for blacklisting has the wrong format: "' . $email . '"'
            );

            return false;
        }

        $conf = self::getBlacklistConf();
        $blockedEmailAddresses = json_decode($conf['emailAddresses'], true);

        if (empty($blockedEmailAddresses) || !is_array($blockedEmailAddresses)) {
            $blockedEmailAddresses = [];
        }

        foreach ($blockedEmailAddresses as $blockedEmail) {
            if (mb_strpos($blockedEmail, '*') === false) {
                if ($email === $blockedEmail) {
                    return true;
                }

                continue;
            }

            $blockedParts = explode('@', $blockedEmail);

            if (empty($blockedParts[0]) || empty($blockedParts[1])) {
                QUI\System\Log::addError(
                    'Package quiqqer/contact -> An e-mail address that is used for blacklisting'
                    . ' has the wrong format: "' . $blockedEmail . '"'
                );

                continue;
            }

            $emailParts = explode('@', $email);
            $emailName = $emailParts[0];
            $emailHost = $emailParts[1];
            $blockedName = $blockedParts[0];
            $blockedHost = $blockedParts[1];

            $blockedNameRegex = '#' . str_replace(['.', '*'], ['\\.', '.*'], $blockedName) . '#i';
            $blockedHostRegex = '#' . str_replace(['.', '*'], ['\\.', '.*'], $blockedHost) . '#i';

            preg_match($blockedNameRegex, $emailName, $nameMatches);
            preg_match($blockedHostRegex, $emailHost, $hostMatches);

            if (!empty($nameMatches) && !empty($hostMatches)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if an IP is listed in one of the provided blacklists
     *
     * @param string $ip - IPv4 address
     * @param bool $returnBlockingList - Return the host of the blacklist provider the IP address
     * is on (if the IP is blocked!)
     * @return bool|string
     */
    public static function isIpBlacklistedByDNSBL(string $ip, bool $returnBlockingList = false): bool|string
    {
        $conf = self::getBlacklistConf();

        if (!$conf['useDNSBL']) {
            return false;
        }

        $providers = json_decode($conf['DNSBLProviders'], true);
        $reverse_ip = implode(".", array_reverse(explode(".", $ip)));

        if (empty($providers) || !is_array($providers)) {
            $providers = [];
        }

        // check if nslookup is available and executable
        // If not - use checkdnsrr (disadvantage: has no timeout parameter)
        $isNslookupExecutable = false;
        $nslookupExecutable = trim(`which nslookup`);

        if ($nslookupExecutable) {
            $openBaseDir = ini_get('open_basedir');

            if (empty($openBaseDir)) {
                $isNslookupExecutable = is_executable($nslookupExecutable);
            } else {
                $nslookupPath = pathinfo($nslookupExecutable);
                $nslookupPath = $nslookupPath['dirname'];
                $openBaseDirPaths = explode(':', $openBaseDir);

                foreach ($openBaseDirPaths as $path) {
                    if (mb_strpos($nslookupPath, $path) === 0) {
                        $isNslookupExecutable = true;
                        break;
                    }
                }
            }
        }

        foreach ($providers as $host) {
            $host = $reverse_ip . "." . $host . ".";

            if (!$isNslookupExecutable) {
                if (checkdnsrr($reverse_ip . "." . $host . ".", "A")) {
                    return $returnBlockingList ? $host : true;
                }

                continue;
            }

            // Use nslookup if available
            $cmd = sprintf('nslookup -type=A -timeout=%d %s 2>&1', 3, escapeshellarg($host));
            $response = [];

            @exec($cmd, $response);

            for ($i = 3; $i < count($response); $i++) {
                if (mb_strpos(trim($response[$i]), 'Name:') === 0) {
                    return $returnBlockingList ? $host : true;
                }
            }
        }

        return false;
    }

    /**
     * Get config array for blacklist configuration of quiqqer/contact
     *
     * @return array|null
     */
    protected static function getBlacklistConf(): ?array
    {
        if (!is_null(self::$conf)) {
            return self::$conf;
        }

        try {
            self::$conf = QUI::getPackage('quiqqer/contact')->getConfig()->getSection('blacklist');
        } catch (\Exception $Exception) {
            QUI\System\Log::writeException($Exception);
        }

        return self::$conf;
    }
}

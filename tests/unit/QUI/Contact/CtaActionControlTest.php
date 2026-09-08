<?php

declare(strict_types=1);

namespace QUITests\Contact;

use PHPUnit\Framework\TestCase;
use QUI\Contact\CtaAction\Control;
use ReflectionMethod;

class CtaActionControlTest extends TestCase
{
    public function testContactButtonsDoNotOverwriteFormFieldLabels(): void
    {
        $Control = new class ([
            'title' => 'Contact',
            'description' => 'Description',
            'content' => '<p>Content</p>',
            'name_label' => 'Name',
            'name_placeholder' => 'Name',
            'company_label' => 'Company',
            'company_placeholder' => 'Company',
            'email_label' => 'Form email label',
            'email_placeholder' => 'Email',
            'phone_label' => 'Form phone label',
            'phone_placeholder' => 'Phone',
            'message_label' => 'Message',
            'message_placeholder' => 'Message',
            'submit_label' => 'Send',
            'email' => 'a&b@example.com',
            'emailLabel' => 'Email button',
            'phone' => '+49 123 456',
            'phoneLabel' => 'Phone button',
            'btnStyle' => 'button'
        ]) extends Control {
            public function getPrivacyLink(): string
            {
                return '';
            }
        };

        $html = $Control->getBody();

        self::assertStringContainsString('Form email label', $html);
        self::assertStringContainsString('Form phone label', $html);
        self::assertStringContainsString('Email button', $html);
        self::assertStringContainsString('Phone button', $html);
        self::assertStringContainsString('mailto:a&amp;b@example.com', $html);
        self::assertStringNotContainsString('mailto:a&amp;amp;b@example.com', $html);
    }

    public function testSanitizesConfiguredContentHtml(): void
    {
        $Control = new Control();
        $html = $this->invoke($Control, 'sanitizeContentHtml', [
            '<p onclick="evil()">Safe <strong>bold</strong>' .
            '<script>alert(1)</script><a href="javascript:alert(1)" target="_blank">link</a>' .
            '<span>kept text</span></p>'
        ]);

        self::assertIsString($html);
        self::assertStringContainsString('<strong>bold</strong>', $html);
        self::assertStringContainsString('kept text', $html);
        self::assertStringContainsString('rel="noopener noreferrer"', $html);
        self::assertStringNotContainsString('onclick', $html);
        self::assertStringNotContainsString('<script', $html);
        self::assertStringNotContainsString('javascript:', $html);
        self::assertStringNotContainsString('<span', $html);
    }

    public function testNormalizesCustomButtonSecurityAttributes(): void
    {
        $Control = new Control();
        $button = $this->invoke($Control, 'normalizeButtonConfig', [[
            'text' => ' Test ',
            'identifier' => 'invalid id!<>',
            'icon' => 'fa fa-envelope <script>',
            'cssClass' => 'safe-class invalid<script>',
            'btnType' => 'unknown',
            'size' => 'huge',
            'openBrickWinWidth' => -10,
            'href' => 'javascript:alert(1)',
            'targetBlank' => '1',
            'onClick' => 'evil(); alert(1)',
            'disabled' => 1
        ]]);

        self::assertIsArray($button);
        self::assertSame('Test', $button['text']);
        self::assertSame('invalidid', $button['identifier']);
        self::assertSame('fa fa-envelope', $button['icon']);
        self::assertSame('safe-class', $button['customClass']);
        self::assertSame('primary', $button['btnType']);
        self::assertSame('', $button['size']);
        self::assertSame(0, $button['openBrickWinWidth']);
        self::assertSame('#', $button['href']);
        self::assertTrue($button['targetBlank']);
        self::assertTrue($button['disabled']);
        self::assertSame('', $button['onClick']);
    }

    public function testKeepsSafeButtonLinksAndCallbacks(): void
    {
        $Control = new Control();

        self::assertSame(
            'https://www.example.com/contact',
            $this->invoke($Control, 'sanitizeButtonHref', ['https://www.example.com/contact'])
        );
        self::assertSame('/contact', $this->invoke($Control, 'sanitizeButtonHref', ['/contact']));
        self::assertSame('#', $this->invoke($Control, 'sanitizeButtonHref', ['data:text/html,test']));
        self::assertSame('Contact.open();', $this->invoke($Control, 'sanitizeOnClick', ['Contact.open']));
        self::assertSame(
            'Contact.open("form");',
            $this->invoke($Control, 'sanitizeOnClick', ['Contact.open("form")'])
        );
        self::assertSame('icon-only', $this->invoke($Control, 'getButtonDisplayMode', ['icon']));
        self::assertSame('button', $this->invoke($Control, 'getButtonDisplayMode', ['unknown']));
    }

    public function testCollectBrickParamsStripsThePrefixAndSkipsUnusableValues(): void
    {
        $Control = new Control([
            'param-context' => 'Paket: Starter',
            'param-kickoff' => 'always',
            'param-empty' => '   ',
            'startView' => 'ai',
            'aiBrickId' => '233'
        ]);

        self::assertSame(
            [
                'context' => 'Paket: Starter',
                'kickoff' => 'always'
            ],
            $this->invoke($Control, 'collectBrickParams', [])
        );
    }

    public function testCollectBrickParamsIgnoresEverythingWithoutThePrefix(): void
    {
        // only the prefixed namespace belongs to the opener; a real setting
        // must never be forwarded as a parameter
        $Control = new Control([
            'aiContext' => 'configured fallback',
            'recipient' => 'sales@example.com'
        ]);

        self::assertSame([], $this->invoke($Control, 'collectBrickParams', []));
    }

    public function testResolveAiBrickIdRejectsAnUnusableSelection(): void
    {
        // without a selection there is nothing to render, so the ai view has
        // to downgrade to the form rather than show an empty host
        self::assertSame(0, $this->invoke(new Control(), 'resolveAiBrickId', []));
        self::assertSame(0, $this->invoke(new Control(['aiBrickId' => '']), 'resolveAiBrickId', []));
        self::assertSame(0, $this->invoke(new Control(['aiBrickId' => '0']), 'resolveAiBrickId', []));
        self::assertSame(0, $this->invoke(new Control(['aiBrickId' => 'abc']), 'resolveAiBrickId', []));
        self::assertSame(0, $this->invoke(new Control(['aiBrickId' => '-5']), 'resolveAiBrickId', []));
    }

    /**
     * @param array<int, mixed> $arguments
     */
    private function invoke(Control $Control, string $method, array $arguments): mixed
    {
        $Method = new ReflectionMethod($Control, $method);

        return $Method->invokeArgs($Control, $arguments);
    }
}

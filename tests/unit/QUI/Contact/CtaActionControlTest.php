<?php

declare(strict_types=1);

namespace QUITests\Contact;

use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;
use DOMDocument;
use DOMXPath;
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
        // to fall back to the overview rather than show an empty host
        self::assertSame(0, $this->invoke(new Control(), 'resolveAiBrickId', []));
        self::assertSame(0, $this->invoke(new Control(['aiBrickId' => '']), 'resolveAiBrickId', []));
        self::assertSame(0, $this->invoke(new Control(['aiBrickId' => '0']), 'resolveAiBrickId', []));
        self::assertSame(0, $this->invoke(new Control(['aiBrickId' => 'abc']), 'resolveAiBrickId', []));
        self::assertSame(0, $this->invoke(new Control(['aiBrickId' => '-5']), 'resolveAiBrickId', []));
    }

    /** @return iterable<string, array{string, bool, int, string}> */
    public static function startViews(): iterable
    {
        yield 'overview without offers' => ['select', false, 0, 'select'];
        yield 'overview with form' => ['select', true, 0, 'select'];
        yield 'disabled direct form' => ['form', false, 0, 'select'];
        yield 'disabled form with agent' => ['form', false, 42, 'select'];
        yield 'available form' => ['form', true, 0, 'form'];
        yield 'missing agent with form' => ['ai', true, 0, 'select'];
        yield 'missing agent without form' => ['ai', false, 0, 'select'];
        yield 'available agent' => ['ai', false, 42, 'ai'];
        yield 'invalid start view' => ['invalid', true, 42, 'select'];
    }

    #[DataProvider('startViews')]
    public function testStartViewAvailability(string $start, bool $form, int $agent, string $expected): void
    {
        $Control = $this->createControl(['startView' => $start, 'formEnabled' => $form], $agent);
        self::assertSame($expected, $Control->getViewConfiguration()['startView']);
        $html = $Control->getBody();
        self::assertStringContainsString('data-active-view="' . $expected . '"', $html);
        self::assertSame($form, str_contains($html, 'data-name="form"'));
        self::assertSame($form, str_contains($html, 'data-view-target="form"'));
        self::assertSame($agent > 0, str_contains($html, 'data-view-target="ai"'));
    }

    public function testFormSidebarAiRequiresAllThreeConditions(): void
    {
        foreach ([false, true] as $sidebar) {
            foreach ([false, true] as $button) {
                foreach ([0, 42] as $agent) {
                    $Control = $this->createControl(['formSidebar' => $sidebar, 'formSidebarAi' => $button], $agent);
                    $views = $Control->getViewConfiguration();
                    self::assertSame($sidebar && $button && $agent > 0, $views['formSidebarAi']);
                    self::assertSame($sidebar, $views['formSidebar']);
                    // The sidebar switch never removes the overview's AI offer.
                    $xpath = $this->xpath($Control->getBody());
                    self::assertSame($agent > 0 ? 1 : 0, $xpath->query(
                        '//*[@data-name="selectView"]//*[@data-view-target="ai"]'
                    )->length);
                }
            }
        }
        $views = $this->createControl(['formEnabled' => false, 'formSidebar' => true, 'formSidebarAi' => true], 42)
            ->getViewConfiguration();
        self::assertFalse($views['formSidebar']);
        self::assertFalse($views['formSidebarAi']);
        self::assertFalse($this->createControl()->getViewConfiguration()['formSidebar']);
    }

    public function testOverviewOrdersActionsAndKeepsIndividualDisplayModes(): void
    {
        $Control = $this->createControl([
            'startView' => 'select',
            'formSidebar' => true,
            'btnStyle' => 'rounded',
            'contactDisplay' => 'text',
            'email' => 'hello@example.com',
            'emailLabel' => 'Email',
            'customButtons' => json_encode([
                ['text' => 'First', 'href' => '/first', 'icon' => 'fa fa-calendar', 'group' => 'primary'],
                ['text' => 'Social', 'href' => '/social', 'icon' => 'fa fa-phone', 'group' => 'secondary', 'display' => 'icon'],
                ['text' => 'Second', 'openBrickId' => 123, 'group' => 'primary'],
                ['text' => 'Removed', 'isDisabled' => 1],
                ['text' => 'Disabled', 'disabled' => 1, 'href' => '/disabled'],
                ['text' => 'Invalid icon', 'group' => 'secondary', 'display' => 'icon'],
                ['text' => 'Both', 'group' => 'secondary', 'icon' => 'fa fa-envelope', 'display' => 'icon-text']
            ])
        ], 42);
        $xpath = $this->xpath($Control->getBody());
        $primary = $xpath->query('//*[@data-name="selectView"]/*[@data-name="primaryActions"]/*');
        self::assertSame(5, $primary->length);
        self::assertSame('ai', $primary->item(0)->getAttribute('data-view-target'));
        self::assertSame('form', $primary->item(1)->getAttribute('data-view-target'));
        self::assertSame('First', trim($primary->item(2)->textContent));
        self::assertSame('Second', trim($primary->item(3)->textContent));
        self::assertSame('123', $primary->item(3)->getAttribute('data-open-brick-id'));
        self::assertSame('true', $primary->item(4)->getAttribute('aria-disabled'));
        self::assertSame(2, $xpath->query('//*[@data-name="primaryActions"]//*[contains(@class,"btn__icon")]')->length);
        self::assertSame(0, $xpath->query('//*[@data-name="primaryActions"]//*[contains(@class,"btn-rounded")]')->length);
        $secondary = $xpath->query('//*[@data-name="selectView"]/*[@data-name="secondaryActions"]/*');
        self::assertSame(3, $secondary->length);
        self::assertSame('Email', trim($secondary->item(0)->textContent));
        self::assertSame('', trim($secondary->item(1)->textContent));
        self::assertSame('Social', $secondary->item(1)->getAttribute('aria-label'));
        self::assertStringContainsString('btn-rounded', $secondary->item(1)->getAttribute('class'));
        self::assertSame('Both', trim($secondary->item(2)->textContent));
        self::assertSame(2, $xpath->query('//*[@data-name="selectView"]//*[@data-name="secondaryActions"]//*[contains(@class,"btn__icon")]')->length);
        self::assertSame(3, $xpath->query('//*[@data-name="left"]/*[@data-name="secondaryActions"]/*')->length);
        self::assertSame(0, $xpath->query('//*[contains(text(),"Removed") or contains(text(),"Invalid icon")]')->length);
    }

    public function testBuiltInButtonLabelsAndIconsAreConfigurableAndEscaped(): void
    {
        $attributes = [
            'aiButtonText' => 'Advice <script>alert(1)</script>',
            'aiButtonIcon' => 'fa fa-comments invalid<>',
            'formButtonText' => 'Write & ask',
            'formButtonIcon' => 'fa fa-envelope',
            'formSidebar' => true,
            'formSidebarAi' => true
        ];
        $html = $this->createControl($attributes, 42)->getBody();
        $xpath = $this->xpath($html);
        self::assertStringNotContainsString('<script>', $html);
        self::assertSame(2, $xpath->query('//*[@data-view-target="ai"]')->length);
        foreach ($xpath->query('//*[@data-view-target="ai"]') as $button) {
            self::assertSame($attributes['aiButtonText'], trim($button->textContent));
            self::assertSame(1, $xpath->query('.//span[@class="btn__icon fa fa-comments" and @aria-hidden="true"]', $button)->length);
        }
        self::assertSame('Write & ask', trim($xpath->query('//*[@data-view-target="form"]')->item(0)->textContent));
        self::assertSame(1, $xpath->query('//*[@data-view-target="form"]//span[contains(@class,"fa-envelope")]')->length);

        $default = $this->xpath($this->createControl(['aiButtonText' => ' ', 'formButtonText' => ' '], 42)->getBody());
        self::assertSame(\QUI::getLocale()->get('quiqqer/contact', 'contact.ctaAction.choice.ai'), trim($default->query('//*[@data-view-target="ai"]')->item(0)->textContent));
        self::assertSame(\QUI::getLocale()->get('quiqqer/contact', 'contact.ctaAction.choice.form'), trim($default->query('//*[@data-view-target="form"]')->item(0)->textContent));
        self::assertSame(0, $default->query('//*[@data-name="viewChoice"]//span[contains(@class,"btn__icon")]')->length);
    }

    public function testSecondaryLabelOnlyAppearsWithTextAndSecondaryActions(): void
    {
        $attributes = ['secondaryActionsLabel' => 'More <script>actions</script>'];
        $withoutActions = $this->xpath($this->createControl($attributes)->getBody());
        self::assertSame(1, $withoutActions->query('//*[@data-name="secondaryActionsLabel" and @hidden]')->length);
        $html = $this->createControl($attributes + ['email' => 'test@example.com'])->getBody();
        self::assertStringNotContainsString('<script>', $html);
        $withActions = $this->xpath($html);
        self::assertSame(1, $withActions->query('//*[@data-name="secondaryActionsLabel" and not(@hidden)]')->length);
        $empty = $this->xpath($this->createControl(['email' => 'test@example.com'])->getBody());
        self::assertSame(0, $empty->query('//*[@data-name="secondaryActionsLabel"]')->length);
    }

    public function testZeroAndSingleActionKeepOverviewAndConfiguredText(): void
    {
        foreach ([[], [['text' => 'Appointment', 'href' => '/appointment']]] as $buttons) {
            $html = $this->createControl([
                'startView' => 'form', 'formEnabled' => false,
                'title' => 'Custom overview', 'description' => 'Custom description', 'customButtons' => $buttons
            ])->getBody();
            self::assertStringContainsString('data-active-view="select"', $html);
            self::assertStringContainsString('Custom overview', $html);
            self::assertStringContainsString('Custom description', $html);
            self::assertStringNotContainsString('<form ', $html);
        }
    }

    public function testDisabledFormRejectsSubmissionBeforeValidationAndMail(): void
    {
        $this->expectException(\QUI\Exception::class);
        $this->expectExceptionMessage(\QUI::getLocale()->get('quiqqer/contact', 'contact.ctaAction.formDisabled'));
        $this->createControl(['formEnabled' => false])->send([]);
    }

    public function testFormLabelsReferenceUniqueIdsAcrossInstances(): void
    {
        $xpath = $this->xpath($this->createControl()->getBody() . $this->createControl()->getBody());
        foreach ($xpath->query('//label[@for]') as $label) {
            self::assertSame(1, $xpath->query('//*[@id="' . $label->getAttribute('for') . '"]')->length);
        }
    }

    /** @param array<string, mixed> $attributes */
    private function createControl(array $attributes = [], int $agent = 0): Control
    {
        return new class ($attributes, $agent) extends Control {
            /** @param array<string, mixed> $attributes */
            public function __construct(array $attributes, private readonly int $agent)
            {
                parent::__construct($attributes);
            }

            protected function resolveAiBrickId(): int
            {
                return $this->agent;
            }

            public function getPrivacyLink(): string
            {
                return '';
            }
        };
    }

    private function xpath(string $html): DOMXPath
    {
        $document = new DOMDocument();
        $previous = libxml_use_internal_errors(true);
        $document->loadHTML('<?xml encoding="UTF-8">' . $html);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);
        return new DOMXPath($document);
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

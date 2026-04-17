with resolved_tenant as (
  select id
  from public.tenants
  where slug = 'tan-can-man'
  limit 1
)
insert into public.tenant_content_entries (tenant_id, key, status, value_json)
select resolved_tenant.id, seeded.key, 'published', seeded.value_json
from resolved_tenant
cross join (
  values
    (
      'content.home.hero',
      jsonb_build_object(
        'headline', 'Dumpster Rentals Made Easy',
        'subheadline', 'Proudly serving Central New York with fast delivery and honest pricing.',
        'imageAlt', 'Clean roll-off dumpster delivery in Central New York',
        'availabilityHelper', 'Get instant pricing and availability in your area.',
        'trustItems', jsonb_build_array('Locally owned', 'Fully insured', 'Upfront pricing')
      )
    ),
    (
      'content.home.service_area',
      jsonb_build_object(
        'modalTitle', 'Service area',
        'modalIntro', 'We serve select areas in Central New York.',
        'coverageHeading', 'Currently covered',
        'regionList', jsonb_build_array(
          'Syracuse + surrounding suburbs',
          'Clay, Cicero, Liverpool',
          'Fayetteville, Manlius, DeWitt',
          'Baldwinsville, North Syracuse'
        ),
        'coverageFootnote', 'We’re expanding coverage. More areas coming soon.',
        'unsupportedZipMessage', 'We don’t currently serve ZIP',
        'viewServiceAreaLabel', 'View service area',
        'closeLabel', 'Got it'
      )
    ),
    (
      'content.home.value_props',
      jsonb_build_object(
        'sectionTitle', 'Why choose Tan Can Man?',
        'intro', 'Simple pricing, reliable delivery, and easy online booking.',
        'items', jsonb_build_array(
          jsonb_build_object(
            'title', 'Upfront pricing',
            'headline', 'Flat-rate, no surprises',
            'body', 'Know your total cost up front. No surprise fees or confusing add-ons.'
          ),
          jsonb_build_object(
            'title', 'Reliable service',
            'headline', 'On-time delivery & pickup',
            'body', 'We show up when we say we will—and make pickup just as easy.'
          ),
          jsonb_build_object(
            'title', 'Local & trusted',
            'headline', 'Proudly Central New York',
            'body', 'Locally owned and operated, focused on dependable service and straightforward pricing.'
          )
        )
      )
    ),
    (
      'content.home.how_it_works',
      jsonb_build_object(
        'sectionTitle', 'How it works',
        'intro', 'Simple from delivery to pickup — we’ll keep it easy.',
        'items', jsonb_build_array(
          jsonb_build_object(
            'stepLabel', 'Step 1',
            'title', 'Pick your delivery date',
            'body', 'Choose a date that works for your project — we’ll confirm quickly.'
          ),
          jsonb_build_object(
            'stepLabel', 'Step 2',
            'title', 'We drop it where you want it',
            'body', 'Driveway placement notes supported — we’ll place it safely and neatly.'
          ),
          jsonb_build_object(
            'stepLabel', 'Step 3',
            'title', 'Fill it, then request pickup',
            'body', 'When you’re ready, request pickup and we’ll haul it away.'
          )
        ),
        'footnote', 'Includes up to 3 tons. Overages billed only if exceeded.'
      )
    ),
    (
      'content.faq.home',
      jsonb_build_object(
        'headline', 'FAQs',
        'intro', 'Quick answers to the most common questions.',
        'items', jsonb_build_array(
          jsonb_build_object(
            'question', 'What’s included in the flat-rate price?',
            'answer', 'Delivery, pickup, and your included weight allowance are all covered. If you exceed the included tonnage, we only charge the overage — no surprise fees.'
          ),
          jsonb_build_object(
            'question', 'How long can I keep the dumpster?',
            'answer', 'Every booking includes a standard rental period. If you need extra time, we can review extra days and any added charges.'
          ),
          jsonb_build_object(
            'question', 'Where can you place the dumpster?',
            'answer', 'Driveways are most common. If placement on a street is needed, permits may be required depending on the town. We’ll help you confirm what’s needed.'
          ),
          jsonb_build_object(
            'question', 'What items are not allowed?',
            'answer', 'Common restricted items include tires, batteries, paint, chemicals, and certain electronics. If you’re unsure, text us a photo or list and we’ll confirm quickly.'
          ),
          jsonb_build_object(
            'question', 'How fast can you deliver?',
            'answer', 'Often next-day delivery is available, and sometimes same-day depending on schedule. Enter your ZIP code or call/text and we’ll confirm the soonest option.'
          )
        )
      )
    ),
    (
      'content.pricing.intro',
      jsonb_build_object(
        'headline', 'Dumpster Pricing',
        'defaultBody', 'Simple flat-rate pricing for Central New York.'
      )
    ),
    (
      'content.pricing.promises',
      jsonb_build_object(
        'productBody', 'Base pricing includes delivery, pickup, the standard rental period, and the standard weight allowance.',
        'dimensionLabel', '7'' × 14'' × 4''',
        'featureList', jsonb_build_array(
          'Driveway friendly',
          'Up to 3 tons included',
          'Flexible rental period'
        ),
        'includedHeading', 'What’s included in your rental',
        'includedPricePrefix', 'All included in the',
        'includedPriceSuffix', 'flat rate',
        'includedItems', jsonb_build_array(
            'Delivery & pickup included',
            'Up to 3 tons included',
            'Standard rental period included',
            'No hidden fees'
        ),
        'footnote', 'Extra days and weight overages are billed only when they apply.'
      )
    ),
    (
      'content.support.marketing',
      jsonb_build_object(
        'headline', 'Ready to book your dumpster?',
        'body', 'Check availability in your area — fast delivery, honest pricing, and friendly local support.',
        'primaryContactCtaLabel', null,
        'responseTimeCopy', null
      )
    )
) as seeded(key, value_json)
on conflict (tenant_id, key) do nothing;

# Medical brochure media boundary

Medical Plans already carries the Official `brochure_url` field. The frontend
reads that field from the Official `Plans` dataset and does not contain a
brochure URL allowlist.

The latest AVA Platform source was reviewed before this change. It contains an
`AVAStorage` provider abstraction whose shared provider is local storage. A
Firebase Storage upload implementation exists inside the 5pay module, but it
is not exposed as an approved shared AVA Cloud Media service or Medical Admin
upload contract.

This change therefore does not copy the 5pay Firebase configuration, create a
parallel Firebase project, or upload binary data. The current safe boundary is:

`approved cloud media reference → Medical Official Plans.brochure_url → P7`

Once AVA Platform exposes an approved authenticated Cloud Media upload service,
Medical Admin can add a PLAN-only upload adapter that writes only the returned
reference and metadata through the existing authenticated Medical Official
write path. Until then, brochure PDF/image upload remains blocked by the
missing shared service contract.

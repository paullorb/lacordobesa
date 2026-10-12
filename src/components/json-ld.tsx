/** Renders a schema.org graph as an inline <script type="application/ld+json">.
 *
 *  JSON.stringify escapes nothing that matters inside a JSON string except "<", which would
 *  let a menu item called `</script>` close the tag early, so that one sequence is escaped. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

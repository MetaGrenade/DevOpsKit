import { PageIntro, PageStack, Panel } from "../components/ui/page";

export default function ApiDocsPage() {
  return (
    <PageStack compact={false}>
      <PageIntro
        title="API Reference"
        description={
          <>
            Interactive OpenAPI documentation for the dashboard API. The spec is also available at{" "}
            <a href="/api/v1/openapi.json" className="text-[var(--color-accent-ink)]">
              /api/v1/openapi.json
            </a>
            .
          </>
        }
      />
      <Panel className="panel-compact api-docs-frame-wrap">
        <iframe
          src="/api/v1/docs"
          title="FDT Dashboard API — Swagger UI"
          className="api-docs-frame"
        />
      </Panel>
    </PageStack>
  );
}

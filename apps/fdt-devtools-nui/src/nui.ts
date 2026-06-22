export function nuiFetch<T>(event: string, data?: unknown): Promise<T> {
  const resourceName =
    typeof GetParentResourceName === "function" ? GetParentResourceName() : "fdt_devtools";

  return fetch(`https://${resourceName}/${event}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(data ?? {}),
  }).then((res) => res.json() as Promise<T>);
}

declare function GetParentResourceName(): string;

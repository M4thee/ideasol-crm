// Zachowuje zgodność ze starszym adresem webhooka.
// Właściwa implementacja znajduje się w jednym miejscu, aby oba adresy
// nie rozjechały się przy kolejnych zmianach integracji.
export const runtime = "nodejs";
export { GET, POST } from "@/app/api/meta/webhook/route";

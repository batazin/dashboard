import { AlertTriangle } from "lucide-react"

export function UrgentPriorityNotice() {
  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-semibold">Quando usar a prioridade Urgente?</p>
          <p>
            Use para troca ou remoção de informações que possam prejudicar vendas, como checkout fora do ar,
            preço incorreto, informações erradas nos textos ou entregáveis e páginas que precisam ser retiradas do ar.
          </p>
          <p className="font-medium">
            Ao marcar como urgente, o Dev responsável priorizará este chamado acima dos demais que já estiver executando.
          </p>
        </div>
      </div>
    </div>
  )
}
export function PriorityReviewNotice() {
  return (
    <div
      role="note"
      className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden="true" />
        <p>
          O Dev responsavel ira analisar a prioridade informada e podera ajustar este pedido caso identifique uma urgencia maior ou menor.
        </p>
      </div>
    </div>
  )
}
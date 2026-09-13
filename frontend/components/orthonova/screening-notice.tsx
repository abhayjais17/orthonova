import { ShieldCheck } from 'lucide-react'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
export function ScreeningNotice({ result = false }: { result?: boolean }) {
  return <Alert className="screening-notice" role="note"><ShieldCheck /><AlertTitle>{result ? 'A screening result, not a diagnosis' : 'A helpful first step, not a diagnosis'}</AlertTitle><AlertDescription>{result ? 'This is an illustrative result, not a medical assessment. Please speak with a doctor about any ongoing knee pain or concerns.' : "This is a screening tool only. It does not replace a doctor's examination."}</AlertDescription></Alert>
}

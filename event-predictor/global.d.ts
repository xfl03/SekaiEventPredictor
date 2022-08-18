type Props = { [k in string]?: string }

type FaasHandlerEvent = {
  body: any
  headers: Props
  method: "POST" | "GET" | "PATCH" | "PUT" | "DELETE" | "OPTIONS"
  query: Props
  path: string
}

type FaasHandlerContext = {
  status: (statusCode: number) => FaasHandlerContext
  succeed: (result?: string) => FaasHandlerContext
  fail: (result?: string) => FaasHandlerContext
}

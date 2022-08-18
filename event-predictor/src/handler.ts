import { main } from './predictForSekaiViewer'

const handler = async (event: FaasHandlerEvent, ctx: FaasHandlerContext) => {
  await main()
  ctx.status(200).succeed(JSON.stringify({succeed: true}, null, 2))
}

export = handler

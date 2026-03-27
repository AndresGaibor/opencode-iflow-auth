import { IFlowCLIProxy } from './server.js'

let proxyInstance: IFlowCLIProxy | null = null

export function getProxyInstance(): IFlowCLIProxy {
  if (!proxyInstance) {
    proxyInstance = new IFlowCLIProxy()
  }
  return proxyInstance
}

export async function startProxy(): Promise<IFlowCLIProxy> {
  const proxy = getProxyInstance()
  await proxy.start()
  return proxy
}

export { IFlowCLIProxy } from './server.js'
export * from './types.js'

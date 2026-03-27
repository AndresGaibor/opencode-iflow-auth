import { IFlowCLIProxy } from './dist/iflow/proxy.js';

const proxy = new IFlowCLIProxy();
proxy.start();

setInterval(() => {}, 1000);

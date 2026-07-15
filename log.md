     | App [vto-store:3] exited with code [1] via signal [SIGINT]
PM2          | App [vto-store:3] starting in -fork mode-
PM2          | App [vto-store:3] online
3|vto-store  |  ⨯ Failed to start server
3|vto-store  | Error: listen EADDRINUSE: address already in use :::3020
3|vto-store  |     at Server.setupListenHandle [as _listen2] (node:net:1940:16)
3|vto-store  |     at listenInCluster (node:net:1997:12)
3|vto-store  |     at Server.listen (node:net:2102:7)
3|vto-store  |     at <anonymous> (/home/admin/domains/jewel.omidcity.com/public_html/node_modules/next/src/server/lib/start-server.ts:338:12)
3|vto-store  |     at new Promise (<anonymous>)
3|vto-store  |     at startServer (/home/admin/domains/jewel.omidcity.com/public_html/node_modules/next/src/server/lib/start-server.ts:213:9)
3|vto-store  |     at Module.nextStart (/home/admin/domains/jewel.omidcity.com/public_html/node_modules/next/src/cli/next-start.ts:28:20)
3|vto-store  |     at <anonymous> (/home/admin/domains/jewel.omidcity.com/public_html/node_modules/next/src/bin/next.ts:324:11)
3|vto-store  |     at process.processTicksAndRejections (node:internal/process/task_queues:103:5) {
3|vto-store  |   code: 'EADDRINUSE',
3|vto-store  |   errno: -98,
3|vto-store  |   syscall: 'listen',
3|vto-store  |   address: '::',
3|vto-store  |   port: 3020
3|vto-store  | }
PM2          | App [vto-store:3] exited with code [1] via signal [SIGINT]
PM2          | App [vto-store:3] starting in -fork mode-
PM2          | App [vto-store:3] online
3|vto-store  |  ⨯ Failed to start server
3|vto-store  | Error: listen EADDRINUSE: address already in use :::3020
3|vto-store  |     at Server.setupListenHandle [as _listen2] (node:net:1940:16)
3|vto-store  |     at listenInCluster (node:net:1997:12)
3|vto-store  |     at Server.listen (node:net:2102:7)
3|vto-store  |     at <anonymous> (/home/admin/domains/jewel.omidcity.com/public_html/node_modules/next/src/server/lib/start-server.ts:338:12)
3|vto-store  |     at new Promise (<anonymous>)
3|vto-store  |     at startServer (/home/admin/domains/jewel.omidcity.com/public_html/node_modules/next/src/server/lib/start-server.ts:213:9)
3|vto-store  |     at Module.nextStart (/home/admin/domains/jewel.omidcity.com/public_html/node_modules/next/src/cli/next-start.ts:28:20)
3|vto-store  |     at <anonymous> (/home/admin/domains/jewel.omidcity.com/public_html/node_modules/next/src/bin/next.ts:324:11)
3|vto-store  |     at process.processTicksAndRejections (node:internal/process/task_queues:103:5) {
3|vto-store  |   code: 'EADDRINUSE',
3|vto-store  |   errno: -98,
3|vto-store  |   syscall: 'listen',
3|vto-store  |   address: '::',
3|vto-store  |   port: 3020
3|vto-store  | }
PM2          | App [vto-store:3] exited with code [1] via signal [SIGINT]
PM2          | Script /home/admin/domains/jewel.omidcity.com/public_html/node_modules/next/dist/bin/next had too many unstable restarts (16). Stopped. "errored"
^C
root@srv7524411224:/home/admin/domains/jewel.omidcity.com/public_html# ^C
root@srv7524411224:/home/admin/domains/jewel.omidcity.com/public_html# lsof -i :3020
root@srv7524411224:/home/admin/domains/jewel.omidcity.com/public_html# pm2 list
┌────┬───────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id │ name              │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├────┼───────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 0  │ booking-nextjs    │ default     │ N/A     │ fork    │ 2407545  │ 22h    │ 5    │ online    │ 0%       │ 77.5mb   │ root     │ disabled │
│ 3  │ vto-store         │ default     │ 14.2.18 │ fork    │ 0        │ 0      │ 15   │ errored   │ 0%       │ 0b       │ root     │ disabled │
└────┴───────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
host metrics | cpu: 11.4% | ram usage: 19.1% | eth0: ⇓ 0.001mb/s ⇑ 0.001mb/s | disk: ⇓ 0mb/s ⇑ 0.044mb/s |
root@srv7524411224:/home/admin/domains/jewel.omidcity.com/public_html# 
const { load } = require('./src/config');
const { createApp } = require('./src/app');
const { findNetworkIP } = require('./src/lib/network');

const cfg = load();
const server = createApp(cfg).listen(cfg.port, cfg.host, () => {
    console.log(`🚀 File Server running`);
    console.log(`   Local:   http://localhost:${cfg.port}`);
    console.log(`   Network: http://${findNetworkIP()}:${cfg.port}`);
    console.log(`📁 Serving: ${cfg.root}`);
    console.log(
        `🔒 Password: ${cfg.password ? 'on' : 'off'} | upload: ${cfg.allowUpload ? 'on' : 'off'} | ` +
            `delete/rename: ${cfg.allowModify ? 'on' : 'off'}`
    );
});

server.on('error', (error) => {
    console.error(error.code === 'EADDRINUSE' ? `❌ Port ${cfg.port} is already in use` : error);
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
});

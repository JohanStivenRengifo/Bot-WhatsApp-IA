module.exports = {
    apps: [{
        name: 'bot-meta',
        script: 'server.js',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env: {
            NODE_ENV: 'production',
            PORT: 3008
        },
        env_production: {
            NODE_ENV: 'production'
        }
    }]
};

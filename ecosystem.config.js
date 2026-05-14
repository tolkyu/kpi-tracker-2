module.exports = {
  apps: [{
    name:      'kpi-tracker',
    script:    'server.js',
    node_args: '--env-file=.env',
    autorestart: true,
    watch:       false,
  }],
};

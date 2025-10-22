const nodeCron = require('node-cron');
const tasks = [];

const cron = {
    schedule: (expr, job, options = { scheduled: true, timezone: 'America/Bogota' }) => {
        const task = nodeCron.schedule(expr, job, options);
        tasks.push(task);
        return task;
    },
    //start: () => tasks.forEach(t => t.start()),
    //stop: () => tasks.forEach(t => t.stop()),
};

module.exports = { cron };

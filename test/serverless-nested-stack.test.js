const test = require('ava')
const AWSNestedStacks = require('..')
const Serverless = require('serverless')

test('I can create a AWS nestedStack', t => {
    const serverless = new Serverless()
    const options = {}
    serverless.cli = {
        log: () => { }
    }
    const plugin = new AWSNestedStacks(serverless, options)
    t.is(plugin.options, options)
})

const test = require('ava')
const AWSNestedStacks = require('..')
const Serverless = require('serverless')
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider')

const options = {
    interactive: typeof process.env.CI === 'undefined'
}

function setUpServerless() {
    const serverless = new Serverless(options)
    serverless.cli = {
        log: () => { }
    }
    serverless.setProvider('aws', new AwsProvider(serverless, options))
    return serverless
}

test('I can create a AWS nestedStack', t => {
    const serverless = setUpServerless()
    const plugin = new AWSNestedStacks(serverless, options)
    t.is(plugin.options, options)
})

test('Get template url when baseUrl is a string', t => {
    const serverless = setUpServerless()
    const plugin = new AWSNestedStacks(serverless, options)

    const baseUrl = "https://athing.com/stacks"
    const stack = {
        template: "atemplate.yaml"
    }
    let templateUrl = plugin.getTemplateUrl(baseUrl, stack)
    t.is(templateUrl, `${baseUrl}/${stack.template}`)
})

test('Get template url when baseUrl is an object', t => {
    const serverless = setUpServerless()
    const plugin = new AWSNestedStacks(serverless, options)
    const url = 'https://athing.com/stacks'
    const baseUrl = {
        'Fn::Sub': url
    }
    const stack = {
        template: "atemplate.yaml"
    }
    let templateUrl = plugin.getTemplateUrl(baseUrl, stack)
    t.is(templateUrl['Fn::Sub'], `${url}/${stack.template}`)
})

test('Bucket name is set from self', async t => {
    const serverless = setUpServerless()
    const plugin = new AWSNestedStacks(serverless, options)
    const bucketName = 'GroovyBucket'
    plugin.bucketName = bucketName
    await plugin.setBucketName()
    t.is(plugin.bucketName, bucketName)
})

test('Bucket name is set from provider when deploymentBucket is set', async t => {
    const serverless = setUpServerless()
    const bucketName = 'GoovyBucket'
    serverless.service.provider.deploymentBucket = bucketName
    const plugin = new AWSNestedStacks(serverless, options)
    await plugin.setBucketName()
    t.is(plugin.bucketName, bucketName)
})

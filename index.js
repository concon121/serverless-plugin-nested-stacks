'use strict'

const BbPromise = require('bluebird')
const fs = require('fs')
const path = require('path')
const ref = {}

class AWSNestedStacks {
    constructor(serverless, options) {
        const self = this
        ref.self = self
        this.serverless = serverless
        this.service = serverless.service
        this.serverlessLog = serverless.cli.log.bind(serverless.cli)
        this.options = options
        this.provider = serverless.getProvider('aws')

        this.hooks = {
            'before:package:finalize': self.createNestedStackCfn,
            'before:aws:deploy:deploy:updateStack': () => BbPromise.bind(this)
                .then(self.setBucketName)
                .then(self.uploadNestedTemplates)
        }
    }

    setBucketName() {
        if (ref.self.bucketName) {
            return BbPromise.resolve(ref.self.bucketName)
        }
        return ref.self.provider.getServerlessDeploymentBucketName()
            .then((bucketName) => {
                ref.self.bucketName = bucketName
            })
    }

    getBaseUrl() {
        let baseUrl
        const directoryName = ref.self.serverless.service.package.artifactDirectoryName
        if (ref.self.serverless.service.provider.deploymentBucket) {
            baseUrl = `https://s3.amazonaws.com/${ref.self.serverless.service.provider.deploymentBucket}/${directoryName}`
        } else {
            baseUrl = {
                'Fn::Sub': `https://s3.amazonaws.com/\${ServerlessDeploymentBucket}/${directoryName}`
            }
        }
        return baseUrl
    }

    getTemplateUrl(baseUrl, stack) {
        let templateUrl
        if (typeof baseUrl === 'object') {
            templateUrl = baseUrl
            templateUrl['Fn::Sub'] += `/${stack.template}`
        } else {
            templateUrl = baseUrl + `/${stack.template}`
        }
        return templateUrl
    }

    mergeArray(array) {
        let tagObj = {}
        if (Array.isArray(array)) {
            for (const item of array) {
                Object.assign(tagObj, item)
            }
        } else {
            tagObj = array
        }
        return tagObj
    }

    generateTags(stack) {
        const tags = []
        stack.tags = ref.self.mergeArray(stack.tags)
        for (const property in stack.tags) {
            if (!!Object.getOwnPropertyDescriptor(stack.tags, property)) {
                const newTag = {}
                newTag.Key = property
                newTag.Value = stack.tags[property]
                tags.push(newTag)
            }
        }
        return tags
    }

    createNestedStackCfn() {
        ref.self.serverlessLog('Creating nested stacks in Cloudformation...')
        const stacks = ref.self.serverless.service.custom['nested-stacks'].stacks
        if (stacks) {
            const resources = ref.self.serverless.service.provider.compiledCloudFormationTemplate.Resources
            for (const stack of stacks) {
                if (stack && stack.id && stack.template) {
                    // if this stack is disabled, skip it
                    if (stack.enabled === false) {
                        continue
                    }

                    ref.self.serverlessLog('Stack: ' + stack.template)
                    resources[stack.id] = {
                        Type: 'AWS::CloudFormation::Stack',
                        Properties: {
                            TemplateURL: ref.self.getTemplateUrl(ref.self.getBaseUrl(), stack)
                        }
                    }
                    if (stack.notifications) {
                        resources[stack.id].Properties.NotificationARNs = stack.notifications
                    }
                    if (stack.parameters) {
                        const params = ref.self.mergeArray(stack.parameters)
                        resources[stack.id].Properties.Parameters = params
                    }
                    if (stack.tags) {
                        const tags = ref.self.generateTags(stack)
                        resources[stack.id].Properties.Tags = tags
                    }
                    if (stack.timeout) {
                        resources[stack.id].Properties.TimeoutInMinutes = stack.timeout
                    }
                    if (stack.dependson) {
                        resources[stack.id].DependsOn = stack.dependson
                    }
                } else {
                    const msg = ('Missing required properties for nested stack:\n' +
                                '\tid - Logical ID of the nested stack\n' +
                                '\ttemplate - the name of the nested cloudformation templates')
                    throw new Error(msg)
                }
            }
        }
    }

    uploadNestedTemplates() {
        ref.self.serverlessLog('Uploading nested stacks to S3...')
        const self = this
        const templateFolder = ref.self.serverless.service.custom['nested-stacks'].location || '.'
        const directoryName = ref.self.serverless.service.package.artifactDirectoryName
        const stacks = ref.self.serverless.service.custom['nested-stacks'].stacks
        return BbPromise.map(stacks, stack => {
            ref.self.serverlessLog('Stack: ' + stack.template)
            const body = fs.readFileSync(path.join(templateFolder, stack.template), 'utf8')
            const params = {
                Bucket: self.bucketName,
                Key: `${directoryName}/${stack.template}`,
                Body: body,
                ContentType: 'application/json'
            }
            return ref.self.provider.request('S3', 'putObject', params, ref.self.options.stage, ref.self.options.region)
        })
    }
}
module.exports = AWSNestedStacks

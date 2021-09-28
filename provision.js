// ================== Package Imports ==================
require('dotenv').config();
const Inquirer = require('inquirer');
const fs = require('fs');
const twilio = require('twilio');

// ================== Provision Script ==================
const runProvision = async () => {
  const userRes = await Inquirer.prompt([
    {
      type: 'string',
      name: 'twilioAccountSid',
      message: 'Twilio Account SID',
    },
    {
      type: 'password',
      name: 'twilioAuthToken',
      message: 'Twilio Auth Token',
    },
  ]);
  try {
    // Initialise Twilio Client
    const twilioClient = twilio(
      userRes.twilioAccountSid,
      userRes.twilioAuthToken
    );
    // Gather Defaults for Workspace, Workflow, Task Channel, Chat Service
    const workSpaces = await twilioClient.taskrouter.workspaces.list();
    // Update the "friendlyName" filter here to use a specific Workspace
    const defaultFlexWorkspaceSid = workSpaces.filter(
      (ws) => ws.friendlyName === 'Flex Task Assignment'
    )[0].sid;
    const workFlows = await twilioClient.taskrouter
      .workspaces(defaultFlexWorkspaceSid)
      .workflows.list();
    // Update the "friendlyName" filter here to use a specific Workflow
    const defaultFlexWorkflowSid = workFlows.filter(
      (wf) => wf.friendlyName === 'Assign to Anyone'
    )[0].sid;
    const taskChannels = await twilioClient.taskrouter
      .workspaces(defaultFlexWorkspaceSid)
      .taskChannels.list();
    // Update the "uniqueName" filter here to use a specific Task Channel
    const defaultChatTaskChannelSid = taskChannels.filter(
      (tc) => tc.uniqueName === 'chat'
    )[0].sid;
    const chatServices = await twilioClient.chat.services.list();
    // Update the "friendlyName" filter here to use a specific Chat Service
    const defaultFlexChatServiceSid = chatServices.filter(
      (cs) => cs.friendlyName === 'Flex Chat Service'
    )[0].sid;
    // Create Studio Flow
    const studioFlow = await twilioClient.studio.flows.create({
      friendlyName: 'Twitter DM Flex Handoff',
      status: 'published',
      definition: {
        description: 'A New Flow',
        states: [
          {
            name: 'Trigger',
            type: 'trigger',
            transitions: [
              {
                next: 'send_to_flex',
                event: 'incomingMessage',
              },
              {
                event: 'incomingCall',
              },
              {
                event: 'incomingRequest',
              },
            ],
            properties: {
              offset: {
                x: 0,
                y: 0,
              },
            },
          },
          {
            name: 'send_to_flex',
            type: 'send-to-flex',
            transitions: [
              {
                event: 'callComplete',
              },
              {
                event: 'failedToEnqueue',
              },
              {
                event: 'callFailure',
              },
            ],
            properties: {
              offset: {
                x: 40,
                y: 210,
              },
              workflow: defaultFlexWorkflowSid,
              channel: defaultChatTaskChannelSid,
              attributes:
                '{"name": "{{trigger.message.ChannelAttributes.from}}", "channelType": "web", "channelSid": "{{trigger.message.ChannelSid}}", "customChannel": "Twitter"}',
            },
          },
        ],
        initial_state: 'Trigger',
        flags: {
          allow_concurrent_calls: true,
        },
      },
    });
    const studioFlowSid = studioFlow.sid;
    // Create Flex Flow
    const flexFlow = await twilioClient.flexApi.flexFlow.create({
      integrationType: 'studio',
      channelType: 'custom',
      enabled: true,
      'integration.flowSid': studioFlowSid,
      contactIdentity: 'contact-identity',
      friendlyName: 'Flex Twitter Channel Flow',
      chatServiceSid: defaultFlexChatServiceSid,
      janitorEnabled: true,
    });
    const flexFlowSid = flexFlow.sid;
    // Add .env Items
    envFileContent =
      `\nTWILIO_ACCOUNT_SID=${userRes.twilioAccountSid}\n` +
      `TWILIO_AUTH_TOKEN=${userRes.twilioAuthToken}\n` +
      `FLEX_FLOW_SID=${flexFlowSid}\n` +
      `FLEX_FLOW_SID=${flexFlowSid}\n` +
      `FLEX_CHAT_SERVICE=${defaultFlexChatServiceSid}\n`;
    fs.appendFileSync('flex-twitter/.env', envFileContent);
  } catch (e) {
    console.error(e);
  }
};

runProvision();

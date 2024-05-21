import parsePhoneNumber from 'libphonenumber-js';
import { AgentSettingsAccessorI } from '../interface.js';
import {
  WhatsAppBusinessAccountSettings,
  WhatsAppAgentSettings,
} from '../types.js';

const normalizeSettingPhoneNumber = (
  settings: WhatsAppAgentSettings,
): WhatsAppAgentSettings => {
  const parsedNumber = parsePhoneNumber(settings.phoneNumber);

  if (!parsedNumber) {
    throw new Error(`Invalid phone number format: ${settings.phoneNumber}`);
  }
  return {
    ...settings,
    phoneNumber: parsedNumber.number,
  };
};

export const singleStaticAgentSettingsAccessor = (
  settings: WhatsAppAgentSettings,
): AgentSettingsAccessorI => {
  const normalizedSettings = normalizeSettingPhoneNumber(settings);

  return {
    getAgentSettings: async (agent) =>
      agent.id === normalizedSettings.numberId ? normalizedSettings : null,
    getAgentSettingsBatch: async (numbers) =>
      numbers.map((agent) =>
        agent.id === normalizedSettings.numberId ? normalizedSettings : null,
      ),
  };
};

export const multiStaticAgentSettingsAccessor = (
  settings: WhatsAppBusinessAccountSettings[],
): AgentSettingsAccessorI => {
  const settingsMapping = new Map<string, WhatsAppAgentSettings>();
  for (const { businessAccountId, numbers } of settings) {
    for (const { numberId, phoneNumber } of numbers) {
      settingsMapping.set(
        numberId,
        normalizeSettingPhoneNumber({
          numberId,
          phoneNumber,
          businessAccountId,
        }),
      );
    }
  }

  return {
    getAgentSettings: async (agent) => settingsMapping.get(agent.id) || null,
    getAgentSettingsBatch: async (numbers) =>
      numbers.map((agent) => settingsMapping.get(agent.id) || null),
  };
};

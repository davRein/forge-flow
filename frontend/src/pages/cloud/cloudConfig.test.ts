import { defaultNextcloudUrl, nextcloudUrl } from './cloudConfig.js';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export const cloudConfigTests = [
    { name: 'Cloud access uses a configurable HTTPS origin without forwarding application credentials', run() {
        assert(nextcloudUrl(undefined) === defaultNextcloudUrl, 'Default cloud domain missing');
        assert(nextcloudUrl(' https://files.example.test/ ') === 'https://files.example.test', 'HTTPS origin must normalize');
        for (const value of ['', 'http://files.example.test', 'javascript:alert(1)', 'https://user:password@files.example.test', 'https://files.example.test/?token=private', 'https://files.example.test/#private', 'https://files.example.test/path'])
            assert(nextcloudUrl(value) === null, 'Invalid external target accepted');
    } }
];

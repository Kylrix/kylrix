import { Client, Databases } from 'node-appwrite';

const client = new Client()
    .setEndpoint('https://fra.cloud.appwrite.io/v1')
    .setProject('67fe9627001d97e37ef3')
    .setKey('standard_187e3bd83da464495b62d249297d64d4cafeeb28079f068624cfbaee13d22e33a61557c19f617c7d820e3ea6538886e941abcc9f763e126052b3a1e0f710dd45ebbec8c966415431220c45a4b9df5e06592a7050cf342960d644a3aebe2d8f84c65e4a0fd40a220394c8f76556e05b00f71c1104c75e35dfc2da2e2eab34f58a');

const databases = new Databases(client);

async function run() {
    try {
        console.log("Fetching current collection...");
        const collection = await databases.getCollection('chat', 'users');
        console.log("Current permissions:", collection.$permissions);
        
        let newPermissions = [...collection.$permissions];
        if (!newPermissions.includes('create("users")')) {
            newPermissions.push('create("users")');
            console.log("Adding create(\"users\") permission...");
            await databases.updateCollection('chat', 'users', collection.name, newPermissions, collection.documentSecurity, collection.enabled);
            console.log("Permissions updated!");
        }

        console.log("Checking attributes...");
        const attributes = await databases.listAttributes('chat', 'users');
        const keys = attributes.attributes.map(a => a.key);
        
        if (!keys.includes('userId')) {
            console.log("Creating userId attribute...");
            await databases.createStringAttribute('chat', 'users', 'userId', 256, false);
        }
        if (!keys.includes('appsActive')) {
            console.log("Creating appsActive attribute...");
            await databases.createStringAttribute('chat', 'users', 'appsActive', 256, false, null, true); // array: true
        }
        if (!keys.includes('email')) {
            console.log("Creating email attribute...");
            await databases.createStringAttribute('chat', 'users', 'email', 256, false);
        }
        if (!keys.includes('status')) {
            console.log("Creating status attribute...");
            await databases.createStringAttribute('chat', 'users', 'status', 256, false);
        }
        if (!keys.includes('lastSeen')) {
            console.log("Creating lastSeen attribute...");
            await databases.createDatetimeAttribute('chat', 'users', 'lastSeen', false);
        }

        console.log("Fix complete. Note: Attributes might take a few seconds to become available.");
    } catch(e) {
        console.error("Error:", e.message || e);
    }
}
run();

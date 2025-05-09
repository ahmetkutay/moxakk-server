import { getSofaScorePlayerService } from './services/football/sofaScorePlayerService';

async function testPlayerSearch() {
  try {
    const playerService = getSofaScorePlayerService();

    // Test case 1: Search for a player without team
    console.log('Test case 1: Search for a player without team');
    const result1 = await playerService.searchPlayerApi('arda guler');
    console.log('Result 1:', result1);

    // Test case 2: Search for a player with correct team
    console.log('\nTest case 2: Search for a player with correct team');
    const result2 = await playerService.searchPlayerApi('arda guler', 'Real Madrid');
    console.log('Result 2:', result2);

    // Test case 3: Search for a player with similar team name
    console.log('\nTest case 3: Search for a player with similar team name');
    const result3 = await playerService.searchPlayerApi('arda guler', 'Madrid');
    console.log('Result 3:', result3);

    // Test case 4: Search for a player with wrong team
    console.log('\nTest case 4: Search for a player with wrong team');
    const result4 = await playerService.searchPlayerApi('arda guler', 'Barcelona');
    console.log('Result 4:', result4);

  } catch (error) {
    console.error('Error testing player search:', error);
  }
}

testPlayerSearch();

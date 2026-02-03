import { Connection, PublicKey } from '@solana/web3.js';

const TOKEN_FACTORY_PROGRAM_ID = new PublicKey('GR3SKk9xaYmwpKxDSbj7GrCbCfnjmNbXZA5eixQ6sFiL');
const BONDING_CURVE_PROGRAM_ID = new PublicKey('7ga6V6vNK5Mbz1QtFz88AFHaa4wBpMMHa2egmPwZTK5X');

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

async function main() {
  console.log('=== Checking Deployed Programs ===\n');
  
  // Check Token Factory
  console.log('Token Factory Program:', TOKEN_FACTORY_PROGRAM_ID.toBase58());
  const factoryProgram = await connection.getAccountInfo(TOKEN_FACTORY_PROGRAM_ID);
  if (factoryProgram) {
    console.log('  ✅ EXISTS');
    console.log('  Owner:', factoryProgram.owner.toBase58());
    console.log('  Executable:', factoryProgram.executable);
    console.log('  Data length:', factoryProgram.data.length, 'bytes');
  } else {
    console.log('  ❌ NOT FOUND - Program not deployed!');
  }
  
  console.log('\n');
  
  // Check Bonding Curve
  console.log('Bonding Curve Program:', BONDING_CURVE_PROGRAM_ID.toBase58());
  const curveProgram = await connection.getAccountInfo(BONDING_CURVE_PROGRAM_ID);
  if (curveProgram) {
    console.log('  ✅ EXISTS');
    console.log('  Owner:', curveProgram.owner.toBase58());
    console.log('  Executable:', curveProgram.executable);
    console.log('  Data length:', curveProgram.data.length, 'bytes');
  } else {
    console.log('  ❌ NOT FOUND - Program not deployed!');
  }
  
  console.log('\n');
  
  // Check Factory PDA
  const [factoryPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('factory')],
    TOKEN_FACTORY_PROGRAM_ID
  );
  console.log('Factory PDA:', factoryPDA.toBase58());
  const factoryPDAAccount = await connection.getAccountInfo(factoryPDA);
  if (factoryPDAAccount) {
    console.log('  ✅ INITIALIZED');
    console.log('  Owner:', factoryPDAAccount.owner.toBase58());
    console.log('  Data length:', factoryPDAAccount.data.length, 'bytes');
    console.log('  Data (hex):', factoryPDAAccount.data.toString('hex').slice(0, 100) + '...');
  } else {
    console.log('  ❌ NOT INITIALIZED - needs InitializeFactory call');
  }
}

main().catch(console.error);

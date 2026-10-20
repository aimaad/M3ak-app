import { customerHasIdentity } from '../documents';

describe("pièce d'identité du client", () => {
  it('accepte un numéro de CIN ou passeport sur la fiche', () => {
    expect(customerHasIdentity({ cinOuPasseport: 'Z188822' })).toBe(true);
    expect(customerHasIdentity({ cinOuPasseport: '   ' })).toBe(false);
    expect(customerHasIdentity({ cinOuPasseport: null })).toBe(false);
  });

  it('accepte un document CIN ou passeport avec numéro ou fichier', () => {
    expect(customerHasIdentity({ cinOuPasseport: null, documents: [{ type: 'cin', reference: 'F670782', path: null }] })).toBe(true);
    expect(customerHasIdentity({ cinOuPasseport: null, documents: [{ type: 'passeport', reference: null, path: 'a/b.jpg' }] })).toBe(true);
  });

  it("ignore un document vide ou d'un autre type (le permis n'est pas une pièce d'identité)", () => {
    expect(customerHasIdentity({ cinOuPasseport: null, documents: [{ type: 'cin', reference: ' ', path: null }] })).toBe(false);
    expect(customerHasIdentity({ cinOuPasseport: null, documents: [{ type: 'permis', reference: '20/086579', path: 'p.jpg' }] })).toBe(false);
  });
});

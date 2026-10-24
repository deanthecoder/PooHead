type
	Card=record
		Suit	:	shortint;
		Number:	String[2];
		Value : shortint;
	end;

	Wad=Array[1..52] of Card;
	PlayerType=record
		Hand	: Wad;
	end;



const
	tr=0;
	sr=3;
	Main=6;


var
	Player		: Array[1..3] of PlayerType;
	Deck,Pile	: Wad;
	LeftCard	:	Integer;
	Finished	: Boolean;

	CurrentPlayer	:	integer;
	CardSelected	: Array [1..52] of boolean;
	SelectedValue	: integer;
	GoFast				:	Boolean;
	PlayersLeft		: Integer;
	Finale				:	Boolean;
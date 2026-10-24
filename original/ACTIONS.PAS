Procedure CPUPlays; forward;
Function PlayerFinished : Boolean; forward;
Procedure InfoBox; forward;


procedure ClearThePack;
var
	i	:	Integer;
begin
	{ Clear the pack in memory }
	for i:=1 to 52 do
		Pile[i].Suit:=0;

	{ Redraw screen }
	UpdateSelection(True);
end;



procedure Reduce(var num:Integer);
var
	Temp	:	String[10];
	a,b,c	:	Boolean;
begin
	Num:=Num-1;

	if num=1 then begin
		CurrentPlayer:=1;
		a:=PlayerFinished;
		CurrentPlayer:=2;
		b:=PlayerFinished;
		CurrentPlayer:=3;
		c:=PlayerFinished;

		if a and b then Temp:='cpu 2 is';
		if a and c then Temp:='cpu 1 is';
		if b and c then Temp:='you are';

		Message(Temp+' the shithead!');
		Finished:=True;
		Finale:=True;
	end;
end;



procedure SortCards;
var
	Temp		:	Card;
	i,j,Max	: Integer;
begin
	{ Find last card }
	Max:=52;
	while (Player[CurrentPlayer].Hand[Max].Suit=0) do begin
		if Max=8 then Exit;

		Dec(Max);
	end;

	{ Bubble Sort cards }
	for j:=7 to Max-1 do
		for i:=7 to Max-1 do
			if Player[CurrentPlayer].Hand[i].Value>Player[CurrentPlayer].Hand[i+1].Value then begin
				Temp:=Player[CurrentPlayer].Hand[i];
				Player[CurrentPlayer].Hand[i]:=Player[CurrentPlayer].Hand[i+1];
				Player[CurrentPlayer].Hand[i+1]:=Temp;
			end;
end;



Procedure ScrollUpPack;
var
	i 		: integer;
	Temp 	: Card;
begin
	temp:=Deck[1];

	for i:=1 to 51 do
		Deck[i]:=Deck[i+1];

	Deck[52]:=Temp;
end;



Procedure CreateShuffleDeal;
const
	lValue : Array[1..13] of integer=(15,3,4,5,6,7,8,9,16,11,12,13,14);
var
	c,i,j 	: integer;
	Number 	: string[15];
	Temp		: Card;
begin
	{ Initialise }
	Number:='23456789 JQKA';
	CurrentPlayer:=1;

	{ Set card properties }
	for i:=1 to 52 do begin
		Deck[i].suit:=((i-1) div 13)+1;
		Deck[i].Value:=lValue[((i-1) mod 13)+1];
		Deck[i].Number:=Number[((i-1) mod 13)+1];

		if Deck[i].Number=' ' then Deck[i].Number:='10';
	end;

	{ Shuffle }
	randomize;
	for i:=1 to 1000 do begin
		{ Get 1st card }
		c:=Random(52)+1;

		{ Get 2nd card }
		repeat
			j:=Random(52)+1;
		until j<>c;

		{ Swap 'em }
		Temp:=Deck[c];
		Deck[c]:=Deck[j];
		Deck[j]:=Temp;
	end;

	{ Fill players hands with poo }
	for i:=1 to 3 do
		for j:=1 to 52 do begin
			Player[i].Hand[j].Suit:=0;
			Pile[i].Suit:=0;
		end;

	{ Deal 9 cards to each player }
	c:=1;
	for i:=1 to 3 do
		for j:=1 to 9 do begin
			Player[i].Hand[j]:=Deck[c];
			Deck[c].suit:=0;
			Inc(c);
		end;

	{ Make first card on deck available }
	while Deck[1].suit=0 do ScrollUpPack;

	{ Set first visible player card to 1 }
	LeftCard:=Main+1;

	{ Sort Player's primary hand }
	SortCards;
end;



Function InZone(x1,y1,x2,y2:integer) : boolean;
begin
	InZone:=False;
	if m.mx>=x1 then
		if m.mx<=x2 then
			if m.my>=y1 then
				if m.my<=y2 then
					InZone:=True;
end;



Function CardUnderMouse : Integer;
var
	i,x,y	:	integer;
begin
	{ Default : No card selected }
	CardUnderMouse:=0;

	{ Check Main hand }
	for i:=LeftCard to LeftCard+4 do
		if Player[1].Hand[i].suit<>0 then begin
			x:=30+(i-LeftCard)*54;
			y:=125;
			if InZone(x,y,x+44,y+59) then begin
				CardUnderMouse:=i;
				Exit;
			end;
		end;

	{ Check secondary hand (Top cards) }
	for i:=4 to 6 do
		if Player[1].Hand[i].suit<>0 then begin
			x:=((i-3)*47)-38;
			y:=27;
			if InZone(x,y,x+44,y+59) then begin
				CardUnderMouse:=i;
				Exit;
			end;
		end;

	{ Check secondary hand (Underneath top cards) }
	for i:=1 to 3 do
		if (Player[1].Hand[i].suit<>0) and (Player[1].Hand[i+3].Suit=0) then begin
			x:=(i*47)-38;
			y:=20;
			if InZone(x,y,x+44,y+59) then begin
				CardUnderMouse:=i;
				Exit;
			end;
		end;

	{ Check top card }
	x:=246;
	y:=23;
	if InZone(x,y,x+44,y+59) then begin
		CardUnderMouse:=100;
		Exit;
	end;

	{ Check left scrolly }
	if LeftCard>7 then begin
		x:=3;
		y:=140;
		if InZone(x,y,x+9,y+29) then begin
			CardUnderMouse:=101;
			Exit;
		end;
	end;

	{ Check Right scrolly }
	if Player[1].Hand[LeftCard+5].suit<>0 then begin
		x:=306;
		y:=140;
		if InZone(x,y,x+9,y+29) then begin
			CardUnderMouse:=102;
			Exit;
		end;
	end;

	{ Check Info square }
	if InZone(0,0,2,2) then begin
		CardUnderMouse:=103;
		Exit;
	end;
end;



procedure DoSelection(var CardNumber : Integer);
begin
	{ Wait until button released }
	while m.rmr=0 do
		UpdateMouse;

	{ Don't allow covered cards to be selected }
	if CardNumber<4 then Exit;

	{ If secondary card selected, and it's OK to select, select it }
	if (CardNumber>0) and (CardNumber<7) then begin
		if Player[1].Hand[7].Suit<>0 then
			Exit;

		{ Select }
		if (SelectedValue=0) or (Player[1].Hand[CardNumber].Value=SelectedValue) then begin
			SelectedValue:=Player[1].Hand[CardNumber].Value;

			CardSelected[CardNumber]:=Not CardSelected[CardNumber];
			UpdateSelection(Not CardSelected[CardNumber]);
			Exit;
		end;
	end;

	{ If primary card selected, select it }
	if CardNumber>6 then
		{ Select }
		if (SelectedValue=0) or (Player[1].Hand[CardNumber].Value=SelectedValue) then begin
			SelectedValue:=Player[1].Hand[CardNumber].Value;

			CardSelected[CardNumber]:=Not CardSelected[CardNumber];
			UpdateSelection(Not CardSelected[CardNumber]);
			Exit;
		end;
end;



procedure ClearSelectedCards;
var
	i	:	Integer;
begin
	for i:=1 to 52 do
		CardSelected[i]:=False;

	SelectedValue:=0;
end;



procedure MakeSpaceOnPile(a:Card);
var
	i	:	Integer;
begin
	{ Make space on top of pile }
	for i:=52 downto 2 do
		Pile[i]:=Pile[i-1];

	{ Add card to top of pile }
	Pile[1]:=a;
end;



procedure RemoveCard(var a:Wad;num:integer);
var
	i	:	Integer;
begin
	{ Remove card }
	if num<7 then begin
		a[num].Suit:=0;
		Exit;
	end;

	for i:=num to 51 do
		a[i]:=a[i+1];

	{ Clear last card }
	a[52].Suit:=0;
end;



procedure SendToPile(var a:Wad);
var
	i : Integer;
begin
	{ Move selected cards }
	for i:=52 downto 1 do
		if CardSelected[i] then begin
			MakeSpaceOnPile(a[i]);
			RemoveCard(a,i);
		end;

	{ Clear Selection }
	ClearSelectedCards;

	{ Display changes }
	DrawDeck;
	Dump(vAddr,$a000);
	UnCoverMouse;
end;



procedure PickUpDeck(var a:wad);
var
	s,i : Integer;
begin
	{ Return if no cards on pile }
	if Pile[1].Suit=0 then begin
		Message('No cards to pick up!');
		Exit;
	end;

	{ Get first free slot in player's hand }
	s:=7;
	while a[s].Suit<>0 do Inc(s);

	{ Add pile to Hand }
	i:=1;
	while Pile[i].Suit<>0 do begin
		a[s]:=Pile[i];
		Pile[i].Suit:=0;
		Inc(i);
		Inc(s);
	end;

	{ Sort new hand }
	SortCards;

	{ Update Screen }
	UpDateSelection(True);
end;



procedure GivePlayerCard(var a:wad);
var
	i			:	Integer;
begin
	{ Return if no cards }
	if Deck[1].Suit=0 then begin
		UpdateSelection(True);
		Exit;
	end;

	while a[9].Suit=0 do begin
		{ Get first available slot in player's hand }
		i:=52;
		while a[i].Suit=0 do Dec(i);
		Inc(i);

		{ Put card in player's hand }
		a[i]:=Deck[1];

		{ Shift Up deck }
		ScrollUpPack;
	end;

	SortCards;

	{ Update screen }
	UpdateSelection(True);
end;



function CheckandLay(CardNumber : integer):boolean;
var
	Valid								: Boolean;
	PileSuit,PileValue	:	Integer;
	i,c 								: Integer;
	OK									: Boolean;
begin
	CheckandLay:=False;

	{ Return if out }
	if PlayerFinished then begin
		CheckandLay:=True;
		Exit;
	end;

	{ Error if top card selected when primary cards left }
	if CardNumber<7 then
		if Player[1].Hand[7].Suit<>0 then
			Exit;

	{ Get current top card on pile }
	PileValue:=Pile[1].Value;
	PileSuit:=Pile[1].Suit;

	{ Select single card if necessary }
	if Not CardSelected[CardNumber] then begin
		ClearSelectedCards;
		SelectedValue:=Player[1].Hand[CardNumber].Value;
		CardSelected[CardNumber]:=True;
	end;

	{ Send all selected cards to top of pile }
	SendToPile(Player[1].Hand);

	{ Is move valid? }
	Valid:=False;
	if Pile[1].Value>=PileValue then Valid:=True;
	if (Pile[1].Number='2') or (PileValue=15) then Valid:=True;
	if PileSuit=0 then Valid:=True;

	{ Pick up pile if card(s) not big enough }
	if Not Valid then begin
		Message('Card not high enough!');
		PickUpDeck(Player[1].Hand);
		CheckandLay:=False;
		Exit;
	end;

	{ If 10 layed, clear the pack and have another go }
	CheckandLay:=True;
	if Pile[1].Number='10' then begin
		Message('10 clears the pack...');
		ClearThePack;
		CheckandLay:=False;
	end else begin
		{ Clear the pack if the top four cards are the same }
		c:=1;
		for i:=2 to 4 do
			if Pile[i].Value=Pile[1].Value then
				Inc(c);
		OK:=True;
		for i:=1 to 4 do
			if Pile[i].Suit=0 then
				OK:=False;

		if (c=4) and OK then begin
			Message('top 4 cards are the same. Pack cleared.');
			ClearThePack;
			CheckandLay:=False;
		end;
	end;

	{ Ensure player has at least 3 cards }
	GivePlayerCard(Player[CurrentPlayer].Hand);
end;



procedure ScrollDeck(num : Integer);
begin
	{ Scroll in memory }
	if num=101 then
		Dec(LeftCard)
	else
		Inc(LeftCard);

	{ Refresh screen }
	UpdateSelection(True);
end;



procedure CompleteRound;
Label
	Beginning;
var
	CardNumber	:	Integer;
begin
	{ Computer's Go? }
	if CurrentPlayer>1 then begin
		CPUPlays;
		Exit;
	end;

	{ Has Player finished? }
	if PlayerFinished then Exit;

	{ Human Round }
	ClearSelectedCards;
	repeat
		Beginning:

		{ Wait until mouse clicked }
		repeat
			UpdateMouse;
		until (m.lmb<>0) or (m.rmb<>0);

		{ If mouse isn't on a card, retry }
		CardNumber:=CardUnderMouse;
		if CardNumber=0 then begin
			if m.rmb<>0 then begin
				while m.rmb<>0 do UpdateMouse;
				if not AnotherGo then begin
					{ Free previously allocated data }
					FreeGraphics;

					{ Set text mode }
					Textmode;
					Writeln('Thankyou for playing ShitHead!');
					halt;
				end;
			end;
			goto Beginning;
		end;

		{ If right button pressed, make appropriate selection }
		if m.rmb<>0 then
			DoSelection(CardNumber);

		{ If left button pressed }
		if m.lmb<>0 then begin
			while m.lmr=0 do UpdateMouse;

			{ Pick up deck? }
			if CardNumber=100 then begin
				PickUpDeck(Player[1].Hand);
				goto Beginning;
			end;

			{ Check/lay card(s) }
			if CardNumber<100 then
				if CheckandLay(CardNumber) then begin
					if PlayerFinished then begin
						Message('Human player is out!');
						Reduce(PlayersLeft);
					end;
					Exit;
				end else begin
					Goto Beginning;
				end;

			{ Check scrollers }
			if (CardNumber=101) or (CardNumber=102) then begin
				ScrollDeck(Cardnumber);
				goto Beginning;
			end;

			{ Check info box }
			if CardNumber=103 then begin
				InfoBox;
			end;
		end;
	until False;
end;
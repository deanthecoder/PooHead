Function TopFourSame : Boolean;
begin
	TopFourSame:=False;

	if Pile[1].Suit*Pile[2].Suit*Pile[3].Suit*Pile[4].Suit=0 then Exit;

	if (Pile[1].Value=Pile[2].Value) and  (Pile[2].Value=Pile[3].Value) and
		 (Pile[3].Value=Pile[4].Value) then TopFourSame:=True;
end;



Function PlayerFinished : Boolean;
var
	i	:	Integer;
	poo : Boolean;
begin
	PlayerFinished:=True;
	Poo:=True;

	for i:=1 to 52 do
		if Player[CurrentPlayer].Hand[i].Suit<>0 then begin
			PlayerFinished:=False;
			Poo:=False;
		end;

	if Poo and (CurrentPlayer=1) then GoFast:=True;
end;



Function SecondRow : Boolean;
begin
	SecondRow:=False;
	if (Player[CurrentPlayer].Hand[4].Suit<>0) or
		 (Player[CurrentPlayer].Hand[5].Suit<>0) or
		 (Player[CurrentPlayer].Hand[6].Suit<>0) then
		SecondRow:=True;
end;



Function FirstRow : Boolean;
begin
	FirstRow:=False;

	if SecondRow then Exit;

	if Player[CurrentPlayer].Hand[7].Suit=0 then
		if Player[CurrentPlayer].Hand[1].Suit+
			 Player[CurrentPlayer].Hand[2].Suit+
			 Player[CurrentPlayer].Hand[3].Suit<>0 then
			FirstRow:=True;
end;



Function Higher(a:Card) : Boolean;
begin
	Higher:=False;

	if (a.Number='2') or (Pile[1].Number='2') then Higher:=True;
	if a.Value>=Pile[1].Value then Higher:=True;
	if Pile[1].Suit=0 then Higher:=True;
end;



Function ChecksOut:Boolean;
begin
	ChecksOut:=False;

	if (Pile[2].Number='2') or (Pile[1].Number='2') then ChecksOut:=True;
	if Pile[1].Value>=Pile[2].Value then ChecksOut:=True;
	if Pile[2].Suit=0 then ChecksOut:=True;
end;



Function Anyinhand : Boolean;
var
	i	:	integer;
begin

end;



Procedure CPUPlays;
var
	Row,CardNo			:	Integer;
	Minimum,i,Old		:	Integer;
	Temp						: String;
label
	Beginning;
begin
	{ Return if player is out }
	Beginning :
	if PlayerFinished then Exit;

	{ Get Player Number }
	Str(CurrentPlayer-1,Temp);

	{ Sort cards }
	SortCards;

	{ Find out which row to take cards out of }
	Row:=2;
	if FirstRow then Row:=1;

	{ Get cards to lay }
	Topcrd:=False;
	case Row of
		1	:	{ Get any of the first three cards }
				begin
					repeat
						CardNo:=Random(3)+1;
					until Player[CurrentPlayer].Hand[CardNo].Suit<>0;
					Topcrd:=True;
				end;
		2 : { Get highest card from second or third row}
				begin
					if Player[CurrentPlayer].Hand[7].Suit<>0 then
						Minimum:=7
					else
						Minimum:=4;

					CardNo:=0;
					for i:=52 downto Minimum do
						if Player[CurrentPlayer].Hand[i].Suit<>0 then
							if Higher(Player[CurrentPlayer].Hand[i]) then
								CardNo:=i;
				end;
	end;

	{ If no card on pile, take any card at random from hand }
	if Pile[1].Suit=0 then begin
		i:=0;
		Old:=CardNo;
		repeat
			CardNo:=Random(45)+7;
			Inc(i);
		until (Player[CurrentPlayer].Hand[CardNo].Suit<>0) or (i>1000);

		if i>1000 then CardNo:=Old;
	end;

	{ If none found, take last one }
	if CardNo=0 then begin
		CardNo:=52;
		while Player[CurrentPlayer].Hand[CardNo].Suit=0 do Dec(CardNo);
	end;

	{ Lay card  }
	MakeSpaceOnPile(Player[CurrentPlayer].Hand[CardNo]);
	RemoveCard(Player[CurrentPlayer].Hand,CardNo);

	{ Check card just layed }
	if ChecksOut then begin
		Temp:='cpu '+Temp+' lays a';
		case Pile[1].Value of
			15		:	Temp:=Temp+' two.';
			3			:	Temp:=Temp+' three.';
			4			:	Temp:=Temp+' four.';
			5			:	Temp:=Temp+' five.';
			6			:	Temp:=Temp+' six.';
			7			:	Temp:=Temp+' seven.';
			8			:	Temp:=Temp+'n eight.';
			9			:	Temp:=Temp+' nine.';
			16		:	Temp:=Temp+' ten.';
			11		:	Temp:=Temp+' jack.';
			12		:	Temp:=Temp+' queen.';
			13		:	Temp:=Temp+' king.';
			14		:	Temp:=Temp+'n ace.';
		end;
		Message(Temp);
	end else begin
		Message('CPU '+Temp+' picks up the pack.');
		PickUpDeck(Player[CurrentPlayer].Hand);
		goto Beginning;
	end;

	{ Re-stock hand }
	GivePlayerCard(Player[CurrentPlayer].Hand);

	{ If a 10 layed, clear the pack and have another go }
	if Pile[1].Number='10' then begin
		Message('pack cleared.');
		ClearThePack;
		goto Beginning;
	end;

	{ Top four cards the same? }
	if TopFourSame then begin
		Message('top four cards the same! pack cleared...');
		ClearThePack;
		goto Beginning;
	end;

	{ Is Computer out? }
	if PlayerFinished then begin
		Str(CurrentPlayer-1,Temp);
		Message('CPU '+Temp+' is out!');
		Reduce(PlayersLeft);
	end;
end;
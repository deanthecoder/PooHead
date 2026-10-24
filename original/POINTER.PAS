var
	OldMouseX,OldMouseY	: integer;
	Mouseshape : String[25];

procedure InitMouse;
begin
	if Minit=0 then begin
		writeln('Error initialising mouse pointer.');
		halt;
	end;

	MouseShape:='  л  '+
							'  л  '+
							'лл лл'+
							'  л  '+
							'  л  ';
end;



procedure CoverMouse;
var
	i,j	: integer;
begin
		{ Repaint covered desktop }
		for j:=OldMouseY-2 to OldMouseY+2 do
			for i:=OldMouseX-2 to OldMouseX+2 do
				PutPixel($a000,i,j,Mem[vAddr:pplookup[j]+i]);
end;



procedure UnCoverMouse;
var
	c,i,j	: integer;
begin
		{ Draw new mouse pointer }
		c:=1;
		for j:=m.my-2 to m.my+2 do
			for i:=m.mx-2 to m.mx+2 do begin
				if MouseShape[c]<>' ' then
					PutPixel($a000,i,j,138);
				Inc(c);
			end;
end;



procedure UpdateMouse;
var
	c,i,j : integer;
begin
	{ Update new mouse position }
	OldMouseX:=m.mx;
	OldMouseY:=m.my;
	mcheck;
	m.mx:=m.mx div 2;

	if (m.mx<>OldMouseX) or (m.my<>OldMouseY) then begin
		Waitvlb;

		{ Repaint covered desktop }
		for j:=OldMouseY-2 to OldMouseY+2 do
			for i:=OldMouseX-2 to OldMouseX+2 do
				if Onscreen(i,j) then
					Mem[$a000:pplookup[j]+i]:=Mem[vAddr:pplookup[j]+i];

		{ Draw new mouse pointer }
		c:=1;
		for j:=m.my-2 to m.my+2 do
			for i:=m.mx-2 to m.mx+2 do begin
				if MouseShape[c]<>' ' then
					PutPixel($a000,i,j,138);
				Inc(c);
			end;
	end;
end;
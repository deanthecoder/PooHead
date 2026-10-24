program ShitHeadMark2;

uses Crt,GLIB,PCX,Fnt,Mouse;

var
	TopCrd:boolean;

{$i Pointer		}
{$i SprLoad		}
{$i Globals		}
{$i Graphics	}
{$i Actions		}
{$i CPU				}
{$i InfoBox		}

label
	Beginning;
begin
	{ Initialise mouse }
	InitMouse;

	{ Set video mode }
	ModeVGA;

	{ Load and display graphics }
	LoadGraphics;

	{ Display initial screen with black palette }
	CreateShuffleDeal;
	UpdateSelection(True);
	FadeOn;

	{ Create the cards }
	Beginning:
	UpdateSelection(True);

	Finished:=False;
	CurrentPlayer:=1;
	GoFast:=False;
	PlayersLeft:=3;
	Finale:=False;
	repeat
		CompleteRound;

		Inc(CurrentPlayer);
		if CurrentPlayer=4 then CurrentPlayer:=1;
	until Finished;

	{ Another go, I wonder... }
	if AnotherGo then begin
		CreateShuffleDeal;
		goto Beginning;
	end;

	{ Free previously allocated data }
	FreeGraphics;

	{ Set text mode }
	Textmode;
	Writeln('Thankyou for playing ShitHead!');
end.